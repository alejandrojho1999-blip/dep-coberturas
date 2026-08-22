#region Using declarations
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Windows.Media;
using NinjaTrader.Cbi;
using NinjaTrader.Data;
using NinjaTrader.Gui;
using NinjaTrader.NinjaScript;
using NinjaTrader.NinjaScript.Indicators;
using NinjaTrader.NinjaScript.DrawingTools;
#endregion

// =====================================================================================
	//
	//  *** CIERRE ANTES DEL CONTADO · REVALIDADO 16-ago-2026 ***
	//  Se prohibio mantener posicion entre las 16:00 y las 17:00 de Nueva York. La plantilla
	//  CME US Index Futures RTH esta en hora CENTRAL (8:30-16:00 CT = 09:30-17:00 NY), asi que
	//  el cierre de sesion caia a las 16:59 NY, una hora DESPUES del cierre del contado y en
	//  una franja de liquidez pobre.
	//  ExitOnSessionCloseSeconds NO sirve para esto: NinjaTrader ignora un desfase de 61
	//  minutos y las salidas seguian cayendo a las 17:00. Se resolvio con un chequeo horario
	//  explicito en OnBarUpdate. Verificado: CERO salidas despues de las 16:00.
	//  Las cifras de abajo son las de esta version. La anterior queda obsoleta.
	//
//
//   PROD_Bot_NQ_ZigZag_Breakout_5min_RTH        v9.7  ·  actualizado 7-ago-2026
//
//   Ruptura de zonas de soporte y resistencia construidas sobre pivotes ZigZag de la
//   apertura. Metodo manual de Luis, cuantificado.
//
// =====================================================================================
//
	// =====================================================================================
	//  EN PRODUCCION  ·  reincorporado el 12-ago-2026  ·  1 contrato MNQ
	// =====================================================================================
	//
	//  ESTUVO EN OBSERVACION 24 HORAS Y SE REVIRTIO. La decision de sacarlo se tomo con un
	//  criterio equivocado: se le aplico el liston de 'estrategia rentable por si sola'
	//  (t 1,82 y Probability 13,10% sobre NQ 2015-2026) cuando la pregunta correcta era si
	//  APORTA AL CONJUNTO. La prueba de portafolio dice que si, y con claridad:
	//
	//    portafolio                        neto      max DD    Net/DD
	//      4 bots (sin ZigZag)          $66.276     -$3.858     17,18
	//      5 bots (con ZigZag)          $84.122     -$4.141     20,32
	//
	//    y en el regimen ANTIGUO, que es donde la cartera sufre:
	//      4 bots  2015-jun2020          $3.490     -$3.858      0,90
	//      5 bots  2015-jun2020         $11.195     -$4.141      2,70
	//
	//  EL ZIGZAG APORTO $7.705 EN ESE PERIODO. Los otros cuatro JUNTOS aportaron $3.490.
	//
	//  DOS RAZONES ESTRUCTURALES:
	//   1) Es el MENOS dependiente del regimen de los cinco. Ratio t_post/t_pre:
	//        ZigZag 1,4x | Momentum 2,0x | Overnight 4,2x | Weekend 5,3x | RSI2 infinito
	//      Es debil en los dos mundos, pero debil de forma CONSISTENTE. En una cartera eso
	//      vale mas que fuerte de forma condicional.
	//   2) En el 10% de PEORES dias del portafolio correlaciona en NEGATIVO con todos los
	//      demas: -0,48 con Momentum, -0,32 con Weekend, -0,38 con Overnight. Gana cuando
	//      los otros pierden, que es justo lo que le faltaba a esta cartera.
	//
	//  CONTRIBUCION MARGINAL: quitarlo cuesta 3,14 puntos de Net/DD al portafolio. Quitar el
	//  Momentum cuesta 2,06 y quitar el Weekend 2,07. Aporta MAS que dos de los que ya estaban.
	//
	//  SOBRE LA OBJECION DE CONCENTRACION que motivo la salida: es cierta (top-3 = 71% del
	//  aporte pre-2020) pero se midio lo mismo en los otros cuatro en ese periodo y TODOS
	//  estan igual: Momentum top-5 = 97%, Weekend 169%, Overnight 117%. No es un defecto del
	//  ZigZag, es como se ve un periodo plano. Se le aplico un criterio que no se aplico al resto.
	//
	//  LO QUE SIGUE SIENDO CIERTO Y HAY QUE TENER PRESENTE:
	//   · Es la estrategia mas debil del portafolio en solitario: t 1,82, Probability 13,10%.
	//   · El 96% de su beneficio historico esta en 10 operaciones de 531.
	//   · Los ultimos 18 meses (mar2025-hoy) restan al portafolio: -$1.789 y Net/DD 7,30 -> 5,59.
	//   · NO subir su tamano por encima de 1 contrato. Su valor es la descorrelacion, no el retorno.
	//
	//  NQ 2015-2026 en solitario: 531 ops, net $178.464, PF 1,23, DD -$40.249, t 1,82.
	//  MNQ 2019-2026: 363 ops, net $19.866, PF 1,38, DD -$3.102, Net/DD 6,41, Probability 1,58%.
	// =====================================================================================
	//
//  ---------------------------------------------------------------------------------
//   CONFIGURACION OPERATIVA  ·  no tocar sin repetir el ciclo de validacion completo
//  ---------------------------------------------------------------------------------
//
//   Instrumento .............. MNQ            Ventana ........... 09:30 - 10:30 NY
//   Grafico .................. 5 MINUTOS      Un trade por dia .. ON
//   Trading Hours ............ CME US Index Futures RTH
//
//   ZigZag desviacion ........ 0,02 %         Solo LARGOS ....... cortos OFF
//   Max alcance vela ......... 0,5            Camino limpio ..... ON
//   Stop offset .............. 2 puntos       Estructura HL/LH .. ON
//   Reward:Risk .............. 2,0            Cierre minimo ..... 0,40
//   Modo de salida ........... CierreSesion   Expiracion orden .. 5 velas
//   Riesgo por operacion ..... $300 (MNQ)     ·  en NQ serian $3.000
//
//   La temporalidad de 5 MINUTOS es parte de la estrategia, no una preferencia: de ella
//   depende cuantas sesiones de memoria conserva el detector (ver mas abajo).
//
//  ---------------------------------------------------------------------------------
//   COMO OPERA
//  ---------------------------------------------------------------------------------
//
//   1. CONSTRUYE ZONAS. Cada pivote que el ZigZag confirma dentro de la ventana
//      09:30-10:30 genera una zona de soporte o resistencia. La zona va del extremo de
//      la mecha al cuerpo de la vela del pivote.
//
//   2. ESPERA LA RUPTURA. Compra cuando una vela de 5 minutos SUPERA el maximo de una
//      zona de resistencia, siempre dentro de la ventana horaria. Basta con que el high
//      perfore el nivel: no se exige cierre por encima.
//
//   3. ENTRA POR STOP. La orden se coloca un tick por encima del extremo de la vela que
//      rompio, y expira si no se ejecuta en 5 velas. Si el broker la rechaza porque el
//      precio ya paso el trigger, se reintenta como limite en el mismo nivel.
//
//   4. STOP EN EL PIVOTE ANTERIOR. No en el extremo opuesto de la zona, sino en el swing
//      confirmado mas reciente por debajo del nivel roto, menos 2 puntos. Es el retroceso
//      que se formo justo antes de la ruptura, asi que el riesgo queda muy ajustado.
//
//   5. SIN OBJETIVO DE BENEFICIO. La posicion corre hasta el cierre de la sesion. Es la
//      pieza que mas rendimiento aporta de todo el diseño: el dinero de las rupturas de
//      apertura esta en los dias tendencia, y un target los amputa.
//
//   6. TAMAÑO POR RIESGO. contratos = floor($300 / (distancia_al_stop x valor_del_punto)).
//      Si el riesgo de un solo contrato ya supera el tope, EL SETUP SE DESCARTA. Por eso
//      este parametro no solo dimensiona: tambien filtra que rupturas se admiten.
//
//  ---------------------------------------------------------------------------------
//   LOS TRES FILTROS DE CALIDAD  ·  las reglas manuales, escritas
//  ---------------------------------------------------------------------------------
//
//   ALCANCE MAXIMO DE LA VELA (0,5)
//     La vela que rompe no puede alejarse del nivel mas de la mitad de la distancia que
//     hay hasta el pivote del stop. Si se aleja mas, la entrada llega tarde y el riesgo
//     se dispara. Se mide del nivel al extremo de la vela.
//
//   CAMINO LIMPIO
//     Ninguna otra zona viva puede interponerse entre la entrada y el objetivo proyectado.
//     Una resistencia intermedia frena el movimiento antes de que pague.
//     NOTA: aunque no se coloca orden de target, el Reward:Risk sigue vivo porque este
//     filtro usa el objetivo proyectado para decidir. Por eso hay que barrerlo igual.
//
//   ESTRUCTURA HL/LH
//     El pivote donde va el stop debe ser un minimo ASCENDENTE respecto al minimo anterior
//     del mismo tipo. Si es mas bajo, la subida esta desgastada y la compra no es valida.
//
//   MOMENTUM DE CIERRE (0,40)
//     La vela que rompe debe cerrar en la parte fuerte de su rango, no devolverlo entero.
//
//  ---------------------------------------------------------------------------------
//   LA MEMORIA ENTRE SESIONES  ·  el rasgo que distingue a esta estrategia
//  ---------------------------------------------------------------------------------
//
//   LAS ZONAS NO SE BORRAN AL CAMBIAR DE DIA. Una resistencia formada en la apertura de
//   ayer o de anteayer sigue viva hoy, y si el precio la rompe durante la ventana de hoy,
//   SE OPERA. La ventana horaria filtra CUANDO se forma el pivote y CUANDO se puede
//   entrar; no exige que ambas cosas ocurran en la misma sesion.
//
//   Cuanta memoria, exactamente. Tres limites simultaneos, manda el que se cumpla antes:
//     · HORA DEL PIVOTE ... solo entre 09:30 y 10:30. Un giro de las 14:00 nunca cuenta.
//     · ALCANCE EN BARRAS . 255 barras. En 5 min y sesion RTH (78 barras/sesion) son
//                           ~3,3 sesiones: la apertura de hoy y las 3 anteriores.
//     · NUMERO DE PIVOTES . como maximo 15 maximos y 15 minimos.
//
//   CICLO DE VIDA DE UNA ZONA ROTA. El estado "rota" no sobrevive al cambio de dia, asi
//   que un nivel perforado ayer vuelve a considerarse hoy. En el chart esas zonas salen
//   en ROJIZO con una "x". El mecanismo, paso a paso:
//     1. Se rompe dentro de la ventana -> LimpiarZonasRotas la saca de zonasVivas. Queda
//        dibujada en el chart, pero ya no puede generar entradas el resto del dia.
//     2. Al cerrar la sesion, LimpiarZonas() vacia zonasVivas Y pivotesUsados por completo.
//     3. A la mañana siguiente ProcesarZigZag la RECREA desde el mismo pivote, que sigue
//        dentro de las 255 barras. Nace con YaFueRota = pivotesRotos.Contains(...) -> solo
//        afecta al color, entra en zonasVivas igual que cualquier otra.
//     4. En esa misma barra LimpiarZonasRotas la vuelve a evaluar contra el precio actual:
//          · si el cierre sigue al otro lado del nivel -> muere al instante, nunca opera.
//          · si el precio regreso -> queda ACTIVA y es operable hoy.
//   O sea: el bot no guarda "esta ya se rompio", vuelve a mirar el precio cada mañana. Una
//   zona solo revive cuando el mercado la ha devuelto a su sitio.
//
//   DOS MATICES DEL ALCANCE DE LimpiarZonasRotas:
//     · Solo corre DENTRO de la ventana y ANTES del trade del dia (esta al final de
//       RevisarRupturas). Una zona perforada a las 14:00 no se retira de la lista; solo
//       MarcarZonasPerforadas la tiñe de rojizo, que es informativo.
//     · Con plantilla RTH no existen barras nocturnas, asi que una rotura en overnight o
//       premercado es INVISIBLE mientras ocurre. Si el precio amanece por encima del nivel,
//       la zona muere en la vela de las 09:30 (paso 4). Si rompio de noche y volvio por
//       debajo antes del open, la rotura no deja rastro y la zona sigue viva.
//
//   POR QUE IMPORTA: esas zonas heredadas aportan ~35 de las 363 operaciones y son las
//   MEJORES del sistema (~$111 por operacion contra $48,69 de media). Ademas actuan como
//   obstaculos del filtro de camino limpio y descartan setups de mala calidad.
//
//   CONSECUENCIA PRACTICA: la memoria depende de la temporalidad. En 1 minuto serian
//   ~0,65 sesiones y en 15 minutos ~10. CAMBIAR EL TIMEFRAME CAMBIA LA ESTRATEGIA.
//
//  ---------------------------------------------------------------------------------
//   LECTURA DEL CHART
//  ---------------------------------------------------------------------------------
//
//   FRANJA AMBAR ....... ventana operativa 09:30-10:30.
//   ZONA AZUL .......... pivote de la apertura de HOY, nunca perforada.
//   ZONA MORADA ........ pivote de una sesion ANTERIOR, con su fecha (dd/MM).
//   ZONA ROJIZA ........ ya perforada antes; el bot la sigue considerando. Etiqueta con "x".
//   Linea naranja ...... precio de entrada  ·  Linea roja ..... stop  ·  Texto WIN/LOSS.
//   Triangulos dorados . operacion IDEAL: el broker rechazo la orden y se marca donde
//                        habria cerrado, para no perder el registro.
//
//  ---------------------------------------------------------------------------------
//   RESULTADOS  ·  MNQ 5min RTH, 01/2019 - 08/2026, 1 contrato
//                  comision NinjaTrader Brokerage + slippage 2 ticks
//  ---------------------------------------------------------------------------------
//
//     Net profit ............. $19.866,30        Operaciones ........... 363
//     Profit factor .......... 1,38              Aciertos .............. 41,87 %
//     Max drawdown ........... -$3.101,60        Media por operacion ... $54,73
//     Net / Drawdown ......... 6,41              Media ganadora ........ $475,46
//     Probability ............ 1,58 %            Media perdedora ....... -$248,36
//     R cuadrado ............. 0,89              Ratio ganancia/perdida  1,91
//     Sharpe / Sortino ....... 0,35 / 0,78       Mejor operacion ....... $1.988,40
//     Max time to recover .... 418 dias          Peor operacion ........ -$349,70
//     Mayor periodo plano .... 50 dias           Perdidas seguidas max . 7
//     Beneficio mensual ...... $229,34           Tiempo en mercado ..... 216 min
//
//   Expectativa con 1 contrato MNQ: ~48 operaciones al año, ~$2.614 anuales.
//   El drawdown de $3.102 equivale al 6,2 % de una cuenta de $50.000.
//
//  ---------------------------------------------------------------------------------
//   VALIDACION
//  ---------------------------------------------------------------------------------
//
//     FASE A  ventana horaria ........ PASA  · 09:30-10:30 gana entre 26 ventanas.
//                                             Alargarla a 11:30 baja el PF a 1,049.
//     FASE B  vecindad, 9 corridas ... PASA  · el peor vecino da PF 1,389 y t 2,78.
//                                             Sin picos ni precipicios: meseta.
//     FASE C  OOS NQ 2015-2019 ....... PASA  · PF 1,350 al centro (1,279-1,396 alrededor).
//     FASE D  6 bloques de regimen ... PASA  · 5 de 6 con PF>1,00, minimo 0,921.
//     FASE E  forward en simulado .... PENDIENTE
//
//   ESTE BOT NUNCA HA OPERADO HACIA ADELANTE. Todo lo anterior es historico. Antes de
//   comprometer capital: ~40 operaciones en SIM, unos 11 meses al ritmo actual.
//
//  ---------------------------------------------------------------------------------
//   RIESGO Y GOBERNANZA
//  ---------------------------------------------------------------------------------
//
//   KILL-SWITCH: pausar el bot si el PnL movil de 12 meses cae por debajo de -$1.000.
//     Es 1,3 veces la peor ventana vivida en 7,6 años y nunca se habria disparado en el
//     historico. Si salta, el comportamiento cambio respecto a todo lo medido.
//
//   BLOQUE 2025-2026 NEGATIVO (PF 0,921 en 56 operaciones). Es el unico de los seis y el
//     regimen actual. Con esa muestra no permite concluir que el edge este roto, pero
//     tampoco se puede ignorar.
//
//   SOLAPAMIENTO CON PROD_Bot_NQ_ORB_Regime, medido sobre 2019-2026:
//     252 dias comunes · r = +0,650 en esos dias · coincidencia de signo 75,4 %.
//     Mismo instrumento, temporalidad, sesion, direccion y concepto. NO diversifica
//     retornos. Los drawdowns si son independientes: por separado suman $4.699 y
//     combinados dan $3.302. Se añade para diversificar riesgo de MODELO, no de retorno.
//
//  ---------------------------------------------------------------------------------
//   DESCARTADO  ·  medido y eliminado del codigo. Reimplementarlo es repetir trabajo.
//  ---------------------------------------------------------------------------------
//
//    1. CORTOS ................ Probability 87,67 % (azar puro), PF 0,78, drawdown propio
//                               -$13.224 para restar $9.739. Cuatro rechazos documentados.
//    2. TARGET FIJO ........... la salida al cierre de sesion lo bate en todo: PF 1,185 ->
//                               1,431 y el drawdown BAJA de $2.503 a $1.983.
//    3. BREAKEVEN ............. patron monotono hacia no aplicarlo; el maximo es no usarlo.
//    4. ENTRADA POR RETEST .... 0 de 104 combinaciones supera PF 1,00 (mediana 0,856).
//    5. TIME-STOP ............. no aporto.
//    6. STOP EN PIVOTE ANTICIPADO . PF 0,95 contra 1,00. El NQ barre el retroceso de rutina.
//    7. FILTROS DE REGIMEN .... SMA diaria y ATR: nunca aportaron.
//    8. MOMENTUM POR VOLUMEN .. pico aislado; eliminaba trades mejores que los que conservaba.
//    9. FILTRO DIA DE SEMANA .. el lastre del miercoles eran los cortos, ya eliminados.
//   10. CERRAR TRAS N GANADAS/PERDIDAS . test de permutacion p=0,655: el azar lo hace mejor.
//   11. DESVIACION EN PUNTOS .. 4,5 pts eran 0,10 % del NQ en 2015 y 0,02 % en 2026: el mismo
//                               numero es otra estrategia segun donde cotice el indice.
//                               Por eso la desviacion es SIEMPRE porcentual.
//   12. VENTANA MAS LARGA ..... 09:30-11:30 -> PF 1,049 · 09:30-12:30 -> PF 1,061.
//   13. ETH / VENTANA NOCTURNA  nunca se testeo; se retiro el soporte para no dejar codigo
//                               muerto. Reimplementarlo exige rehacer el cruce de medianoche.
//
//  ---------------------------------------------------------------------------------
//   NOTAS TECNICAS
//  ---------------------------------------------------------------------------------
//
//   · Calculate.OnBarClose: el backtest es fiel SIN Tick Replay.
//   · Las ordenes de salida son EXPLICITAS (ExitLongStopMarket / ExitLongLimit) colocadas
//     en OnExecutionUpdate y REENVIADAS en cada barra, de modo que si una se rechaza se
//     auto-repara en la vela siguiente. SetStopLoss con precio antes del fill de una orden
//     stop no es fiable en NT8: la posicion puede quedar sin proteccion.
//   · Guarda de emergencia: si al llenarse la entrada el precio ya rebaso el stop (gap o
//     latencia), se sale a mercado de inmediato.
//   · Cierre de sesion: IsExitOnSessionCloseStrategy con 30 s -> flat a las 16:59:30 NY.
//     La plantilla RTH va de 8:30 a 16:00 CENTRAL, o sea 09:30 a 17:00 hora de Nueva York.
//   · modoVisual: en el Strategy Analyzer ChartControl es null y se saltan los Draw.* y los
//     Print. Sin ese guard el Optimizer pasaba de 11 a 67 segundos por iteracion.
//   · MaximumBarsLookBack = 256 y el lookback de 255 barras definen la memoria entre
//     sesiones. No son ajustes de rendimiento: son parte de la estrategia.
//
// =====================================================================================

namespace NinjaTrader.NinjaScript.Strategies
{

	// v8.0: que cierra la operacion ganadora.
	//  TargetFijo    : TP a RR x riesgo (comportamiento validado hasta v7.0).
	//  CierreSesion  : SIN target. Solo stop; la posicion corre hasta el cierre de sesion.
	//    Motivacion: el bot hermano PROD_Bot_NQ_ORB_Regime documenta que en rupturas de la
	//    apertura del NQ "el dinero esta en los dias tendencia; un target los amputa", y que
	//    salida EOD batio a 1.5R y 2R. Nunca lo probamos aqui: barrimos RR de 1,0 a 3,5 pero
	//    SIEMPRE con target fijo. Explicaria la meseta plana de RR que nos extraño.
	public enum ModoSalida
	{
		TargetFijo,
		CierreSesion
	}

	public class PROD_Bot_NQ_ZigZag_Breakout_5min_RTH : Strategy
	{
		private struct Pivot
		{
			public double Price;
			public double BodyEdge;
			public int    BarIndex;
			public bool   IsHigh;
		}

		private class Zone
		{
			public bool   IsHigh;
			public double Level;
			public double BodyEdge;
			public double OppositePivot;
			public int    PivotBar;
			public string Tag;
			public bool   EstructuraOK;   // v4.2: pivote del stop = minimo ascendente (compra) / maximo descendente (venta)
			public bool     EsSesionActual; // v9.6: true = pivote de HOY | false = de una sesion previa. SOLO afecta al color del dibujo, NO a las entradas.
			public DateTime FechaPivote;    // v9.6: sesion en la que se formo el pivote (para la etiqueta del chart)
			public bool     YaFueRota;      // v9.7: el precio ya perforo esta zona en algun momento (solo visual)
		}

		// v5.0 - filtros de regimen sobre la serie DIARIA (BarsArray[1])

		private ZigZag			zz;
		private List<Pivot>		pivots;
		private List<Zone>		zonasVivas;
		private bool			ventanaActiva;
		private Brush			brushFranja;     // v9.2: franja de la ventana horaria (cacheado)
		private Brush			brushZonaHoy;    // v9.6: zona de la sesion en curso (azul)
		private Brush			brushZonaPrev;   // v9.6: zona de una sesion anterior (morado)
		private Brush			brushZonaRota;   // v9.7: zona que el precio ya perforo (rojizo)
		private bool			modoVisual;      // v5.3: true solo si la estrategia corre sobre un CHART.
		private bool			logsActivos;     // v5.3: gate de los Print (mata el throughput en optimizacion)
		private HashSet<int>	pivotesUsados;
		// v9.7: pivotes cuya zona ya se rompio en algun momento. NO se vacia al cambiar de dia,
		// a diferencia de pivotesUsados. Es SOLO INFORMATIVO: sirve para pintarlas distinto y
		// poder auditar cuales son zonas ya perforadas que el bot vuelve a considerar.
		private HashSet<int>	pivotesRotos;
		private List<string>	tagsDibujados;
		private int				lastDay;
		private double			riesgoActivo;

		private Order			ordenStop;
		private int				barraEnvioOrden;   // v4: expiracion medida en BARRAS, no en minutos

		// v4.1: SL/TP como ORDENES EXPLICITAS (ExitLongStopMarket/ExitLongLimit) en vez de
		// SetStopLoss/SetProfitTarget con Price. Motivo: SetStopLoss(Price) fijado ANTES del fill
		// de una orden stop de entrada es poco fiable en NT8 (a veces el stop nunca se adjunta y
		// la posicion queda sin proteccion -- el bug que Luis detecto con RiesgoMaximoUSD=3000).
		// Mismo fix que Luis ya habia aplicado en su viejo scalper EMA v2.
		private double	slTeorico;      // stop calculado al enviar la orden (pivote opuesto +/- offset)
		private double	tpTeorico;      // target teorico (RR x riesgo desde el trigger)
		private double	activeSL;       // stop VIGENTE de la posicion abierta (0 = sin posicion)
		private double	activeTP;
		private bool	esLargo;

		// v4.5: estado para el retest y el backup a mercado
		private double	slPivote;       // stop en el pivote opuesto (fijo, NO depende del precio de entrada)
		private int		qtyPendiente;   // contratos de la orden de entrada pendiente (para el backup)
		private bool	esOrdenLimit;   // la entrada pendiente es un limite (retest) vs stop

		// ROBUSTEZ: si el broker RECHAZA la orden de entrada, no se opera pero se marca el trade IDEAL
		// (entrada + salida donde habria cerrado) y el bot sigue buscando el siguiente setup.
		private double	entradaTeorica;
		private bool	idealActivo;
		private bool	idealEsLargo;
		private double	idealEntrada, idealStop, idealTarget;
		private int		idealBar;
		private bool	idealEntryDrawn;
		private bool	reintentarComoLimit;   // el STOP de entrada fue rechazado -> reintentar como LIMIT (retest)

		// Marcadores de ejecucion real (entrada/salida) dibujados desde OnBarUpdate para que persistan.
		private MarketPosition	posPrevia = MarketPosition.Flat;
		private int				entradaBar;
		private double			entradaPrecio;
		private bool			tradeVivo;
		private double			slTrade, tpTrade;
		private int				qtyTrade;
		private double			riskUSD, rewardUSD;

		protected override void OnStateChange()
		{
			if (State == State.SetDefaults)
			{
				Description									= @"EN PRODUCCION (reincorporado 12-ago-2026). ZigZag breakout MNQ, 5 min, template RTH, 1 contrato. Compra rupturas de zonas de la apertura (09:30-10:30 NY), un trade al dia, solo largos, sin target: corre hasta el cierre. Las zonas NO se borran al cambiar de dia (memoria de ~3 sesiones). EN SOLITARIO ES LA MAS DEBIL DE LA CARTERA: NQ 2015-2026 da t 1,82 y Probability 13,10%, y el 96% del beneficio esta en 10 operaciones de 531. PERO APORTA AL PORTAFOLIO: Net/DD del conjunto sube de 17,18 a 20,32, y en el regimen antiguo (2015-jun2020) de 0,90 a 2,70. Aporto $7.705 en ese periodo contra $3.490 de los otros cuatro JUNTOS. Es el menos dependiente del regimen (ratio t post/pre 1,4x contra 2,0-infinito del resto) y en el 10% de peores dias del portafolio correlaciona NEGATIVO con todos los demas. NO SUBIR DE 1 CONTRATO: su valor es la descorrelacion, no el retorno. Los ultimos 18 meses restan al conjunto (-$1.789). FASE E EN CURSO desde el 11-ago-2026.";
				Name										= "PROD_Bot_NQ_ZigZag_Breakout_5min_RTH";
				Calculate									= Calculate.OnBarClose;
				EntriesPerDirection							= 1;
				EntryHandling								= EntryHandling.AllEntries;
				IsExitOnSessionCloseStrategy				= true;
				ExitOnSessionCloseSeconds					= 3660;
				SegundosAplanado							= 3660;	// 61 min antes del cierre de plantilla (17:00 NY) -> flat 15:59 NY
				MaximumBarsLookBack							= MaximumBarsLookBack.TwoHundredFiftySix;
				BarsRequiredToTrade							= 20;
				RealtimeErrorHandling						= RealtimeErrorHandling.IgnoreAllErrors;
				StopTargetHandling							= StopTargetHandling.PerEntryExecution;
				IsInstantiatedOnEachOptimizationIteration	= true;

				// ============ CONFIGURACION VALIDADA (usar en grafico de 5 MINUTOS) ============
				ZigZagDeviationPct	= 0.02;   // 0,02% del precio. Meseta 4,0-5,0 pts equivalentes (PF 1,17-1,19).
				MaxBreakoutRatio	= 0.5;    // regla manual de Luis, sin cambios

				StopOffsetPoints	= 2.0;
				RiskReward			= 2.0;
				Salida				= ModoSalida.CierreSesion; // v8.1: VALIDADO. Sin target; la posicion corre hasta el cierre.
				RiesgoMaximoUSD		= 300;    // MNQ (v9.1). En NQ usar 3000 = identico riesgo en R.

				BarrasExpiracionOrden	= 5;

				UseCleanPathFilter	= true;   // regla NO-ENTRAR #2 de Luis
				UseStructureFilter	= true;   // regla NO-ENTRAR #3 de Luis

				TradeLongs			= true;
				TradeShorts			= false;  // cortos PF 0,909 contra 1,000 de largos. Medido sobre 3.262 operaciones.

				SessionStartHour	= 9;      // 09:30-10:30 NY: la mejor de 26 ventanas probadas.
				SessionStartMinute	= 30;     // Alargarla a 11:30 baja el PF de 1,171 a 1,049.
				SessionEndHour		= 10;
				SessionEndMinute	= 30;
				OneTradePerDay		= true;   // los trades 2+ del dia pierden -$5,26 vs -$3,60 del primero

				MomCierreMin		= 0.40;   // meseta 0,30-0,50 | t de discriminacion 4,29

				DrawZones			= true;
				DebugZonas			= false;
			}
			else if (State == State.Configure)
			{
				// Se re-asigna aqui a proposito: el Strategy Analyzer cachea las propiedades
				// de sesion y puede ignorar el valor de SetDefaults. Al exponerlo como
				// parametro visible queda auditable en cada corrida.
				ExitOnSessionCloseSeconds = SegundosAplanado;
			}
			else if (State == State.DataLoaded)
			{
				// v5.3: en Strategy Analyzer (backtest y optimizacion) ChartControl es null. Sin este flag,
				// las ~14 llamadas Draw.* y los 21 Print se ejecutaban igual contra un chart inexistente:
				// era el cuello de botella del Optimizer (~67 s por iteracion).
				modoVisual  = ChartControl != null;
				logsActivos = modoVisual || DebugZonas;   // DebugZonas ON permite depurar un backtest suelto

				// v7.0: desviacion SIEMPRE en % del precio. En puntos absolutos el mismo numero es una
				// estrategia distinta segun donde cotice el indice (4,5 pts = 0,10% del NQ en 2015 y
				// 0,02% en 2026) y se descalibra sola con el tiempo.
				zz			= ZigZag(DeviationType.Percent, ZigZagDeviationPct, true);
				pivots		= new List<Pivot>();
				zonasVivas	= new List<Zone>();
				pivotesUsados = new HashSet<int>();
			pivotesRotos  = new HashSet<int>();
				tagsDibujados = new List<string>();
			brushFranja   = new SolidColorBrush(Color.FromArgb(90, 255, 176, 0));
			brushFranja.Freeze();
			// v9.6: dos colores de zona para poder auditar de un vistazo de que sesion viene cada una.
			brushZonaHoy   = new SolidColorBrush(Color.FromRgb(80, 130, 220));   // azul  = apertura de HOY
			brushZonaPrev  = new SolidColorBrush(Color.FromRgb(150, 90, 190));   // morado = apertura de una sesion ANTERIOR
			brushZonaRota  = new SolidColorBrush(Color.FromRgb(190, 90, 90));    // rojizo = ya perforada
			brushZonaHoy.Freeze(); brushZonaPrev.Freeze(); brushZonaRota.Freeze();
				lastDay		= -1;
				ordenStop	= null;

				if (DrawZones)
					AddChartIndicator(zz);
			}
		}

		protected override void OnBarUpdate()
		{
			if (BarsInProgress != 0) return;

			// ---- CIERRE ANTES DEL CONTADO (16:00 NY) --------------------------------------
			// ExitOnSessionCloseSeconds NO sirve para esto: la plantilla RTH cierra a las 17:00
			// NY y NinjaTrader ignora un desfase de 61 minutos, asi que la salida seguia
			// cayendo a las 17:00. Se hace explicito. Con velas de 5 min, la barra que cierra
			// a las 15:55 dispara la orden y esta rellena en la apertura de la barra siguiente,
			// tambien las 15:55, de modo que la posicion queda plana ANTES de las 16:00.
			if (Position.MarketPosition == MarketPosition.Long && ToTime(Times[0][0]) >= 155500)
			{
				ExitLong("CierreContado", "L");
				return;
			}


			ventanaActiva = EnVentana();

			if (modoVisual && DrawZones && ventanaActiva)
				DibujarFranjaHoraria();

			if (CurrentBar < BarsRequiredToTrade) return;

			// Dibuja los triangulos de entrada/salida del trade REAL y su resultado.
			DibujarMarcadoresEjecucion();

			// Seguimiento del trade IDEAL (cuando una entrada fue rechazada): marca donde habria cerrado.
			if (idealActivo)
				ActualizarTradeIdeal();

			// Reintento como LIMIT si el STOP de entrada fue rechazado (el precio se adelanto): esperar el retest.
			if (reintentarComoLimit && Position.MarketPosition == MarketPosition.Flat)
			{
				reintentarComoLimit = false;
				esOrdenLimit    = true;
				barraEnvioOrden = CurrentBar;   // reinicia el conteo de 5 velas para el retest
				if (esLargo) EnterLongLimit(qtyPendiente, entradaTeorica, "L");
				else         EnterShortLimit(qtyPendiente, entradaTeorica, "S");
				Log(string.Format("[ZigZag] STOP rechazado -> reintento LIMIT {0} @ {1} esperando retest (5 velas).",
					esLargo ? "LONG" : "SHORT", entradaTeorica));
			}

			// Al cambiar de sesion: limpiar zonas y cancelar orden viva del dia anterior
			if (lastDay != Time[0].Date.DayOfYear)
			{
				LimpiarZonas();
				CancelarOrdenSiExiste();
				lastDay = Time[0].Date.DayOfYear;
			}

			// Expiracion de la orden de entrada pendiente (en barras)
			if (ordenStop != null
				&& (ordenStop.OrderState == OrderState.Working || ordenStop.OrderState == OrderState.Accepted)
				&& CurrentBar - barraEnvioOrden >= BarrasExpiracionOrden)
			{
				CancelOrder(ordenStop);
				// v4.5: si era un retest (limite) que nunca se toco y el backup esta activo,
				// entrar a MERCADO para no perder el movimiento. Reintroduce el chase -> default OFF.
				Log(string.Format("[ZigZag] Orden de entrada expiro sin llenarse tras {0} velas -> cancelada.",
					BarrasExpiracionOrden));
			}

			// (v9.2: el TIME-STOP se elimino. Estaba en 0 por defecto y documentado como "no aporto";
			//  mantenerlo solo daba una via de romper la config validada.)

			// --- GESTION DE POSICION ABIERTA: reenviar SL/TP explicitos en cada vela ---
			// (liveUntilCancelled + reenvio por barra = auto-reparacion si una orden se rechazo)
			if (Position.MarketPosition == MarketPosition.Long && activeSL > 0)
			{
				ExitLongStopMarket(0, true, Position.Quantity, activeSL, "SL", "L");
				if (activeTP > 0) ExitLongLimit(0, true, Position.Quantity, activeTP, "TP", "L");
			}
			else if (Position.MarketPosition == MarketPosition.Short && activeSL > 0)
			{
				ExitShortStopMarket(0, true, Position.Quantity, activeSL, "SL", "S");
				if (activeTP > 0) ExitShortLimit(0, true, Position.Quantity, activeTP, "TP", "S");
			}
			else if (Position.MarketPosition == MarketPosition.Flat)
			{
				activeSL = 0; activeTP = 0;
			}

			// Avanzar el detector ZigZag (pivotes confirmados -> zonas nuevas)
			ProcesarZigZag();

			// v9.7: marcar (solo para el chart) las zonas que el precio ya ha perforado. Va aqui
			// porque corre en TODAS las barras: LimpiarZonasRotas solo se ejecuta dentro de la
			// ventana y antes del trade del dia, asi que por si sola no se entera de las roturas
			// que ocurren el resto de la jornada.
			MarcarZonasPerforadas();

			if (modoVisual && DrawZones && ventanaActiva)
				foreach (var z in zonasVivas)
					DibujarZona(z);

			// Ruptura AL CIERRE de la vela actual
			if (ordenStop == null && Position.MarketPosition == MarketPosition.Flat && PuedeOperar())
				RevisarRupturas();
		}

		private bool EnVentana()
		{
			return EnRangoHorario(Time[0].TimeOfDay);
		}

		// v5.1: soporta ventanas que CRUZAN MEDIANOCHE (ini > fin), p.ej. 18:00 -> 02:00 (bloque Asia en ETH).
		// Sin esto, cualquier test de horario nocturno devuelve 0 trades porque ini <= fin nunca se cumple.
		// v5.2: el cruce ahora es OPT-IN. Al barrer horarios en el Optimizer se generan combos con
		// inicio > fin (p.ej. 11:00 -> 09:30); sin este guard se interpretarian como ventana nocturna de
		// 22.5h y contaminarian el barrido con resultados sin sentido. Con el guard devuelven 0 trades
		// y el optimizador los descarta solo.
		private bool EnRangoHorario(TimeSpan h)
		{
			TimeSpan ini = new TimeSpan(SessionStartHour, SessionStartMinute, 0);
			TimeSpan fin = new TimeSpan(SessionEndHour,   SessionEndMinute,   0);
			if (ini <= fin) return h >= ini && h <= fin;
			return false;   // v7.0: ventana invalida (inicio > fin). El soporte ETH se retiro: nunca se testeo.
		}

		private void DibujarFranjaHoraria()
		{
			if (!modoVisual) return;   // v5.3
			// v9.2: el gris con alpha 60 se perdia contra el fondo del chart. Ahora ambar con
			// alpha 90: se distingue sobre fondo claro y oscuro sin tapar las velas. El brush se
			// crea UNA vez en DataLoaded (antes se instanciaba en cada barra).
			BackBrush = brushFranja;
		}

		// v4.6: desde que el trade se ABRE (o si el del dia ya cerro) dejamos de crear/dibujar zonas:
		// solo se espera el resultado del trade. Antes de abrir, se siguen dibujando normalmente.
		private bool TradeAbiertoOHechoHoy()
		{
			if (Position.MarketPosition != MarketPosition.Flat) return true;   // trade abierto -> congelar zonas
			if (OneTradePerDay && ContarTradesHoy() >= 1) return true;         // trade del dia ya cerrado
			return false;
		}

		private void DibujarZona(Zone z)
		{
			if (!modoVisual) return;   // v5.3
			// v4.6: no dibujar/extender zonas una vez ABIERTO el trade (o cerrado el del dia) -> se congelan.
			if (TradeAbiertoOHechoHoy()) return;
			double top = Math.Max(z.Level, z.BodyEdge);
			double bot = Math.Min(z.Level, z.BodyEdge);
			int barsAgo = CurrentBar - z.PivotBar;
			if (barsAgo <= 0) return;

			// v9.6: el color dice de que sesion viene la zona.
			//   AZUL   -> pivote de la apertura de HOY.
			//   MORADO -> pivote de la apertura de una SESION ANTERIOR (sigue siendo 100% operable:
			//             asi es como funciona la estrategia, ver bloque v9.5/v9.6 de la cabecera).
			//   ROJIZO -> zona que el precio YA perforo antes (heredada y ya usada). El bot la
			//             sigue considerando: ver "zonas rotas que reviven" en la cabecera.
			Brush fill = z.YaFueRota ? brushZonaRota : (z.EsSesionActual ? brushZonaHoy : brushZonaPrev);
			Draw.Rectangle(this, z.Tag, false, barsAgo, top, 0, bot,
				Brushes.Transparent, fill, z.EsSesionActual ? 25 : 18);

			// Etiqueta con la fecha de origen SOLO en las zonas heredadas, para auditarlas a ojo.
			if (!z.EsSesionActual)
			{
				Draw.Text(this, z.Tag + "_lbl", z.FechaPivote.ToString("dd/MM") + (z.YaFueRota ? " x" : ""), barsAgo,
					top + 4 * TickSize, z.YaFueRota ? brushZonaRota : brushZonaPrev);
			}
		}

		// Lee los pivotes DIRECTAMENTE del indicador ZigZag de NT8 (coinciden con el chart).
		// El pivote mas reciente es el tramo provisional y NO genera zona (desde indice 1).
		private void ProcesarZigZag()
		{
			// v4.6: desde que el trade se ABRE (o si el del dia ya cerro) no se crean mas zonas. Pedido de Luis.
			if (TradeAbiertoOHechoHoy()) return;
			int lookback = Math.Min(255, CurrentBar - 1);
			if (lookback < 3) return;

			pivots.Clear();
			for (int inst = 1; inst <= 15; inst++)
			{
				int hb = SafeBar(true,  inst, lookback);
				if (hb >= 0)
					pivots.Add(new Pivot { Price = High[hb], BodyEdge = Math.Max(Open[hb], Close[hb]),
											BarIndex = CurrentBar - hb, IsHigh = true });
				int lb = SafeBar(false, inst, lookback);
				if (lb >= 0)
					pivots.Add(new Pivot { Price = Low[lb], BodyEdge = Math.Min(Open[lb], Close[lb]),
											BarIndex = CurrentBar - lb, IsHigh = false });
			}
			pivots = pivots.OrderByDescending(p => p.BarIndex).ToList();
			if (pivots.Count < 3) return;

			for (int i = 1; i + 1 < pivots.Count; i++)
			{
				var p   = pivots[i];
				var opp = pivots[i + 1];
				if (opp.IsHigh == p.IsHigh) continue;

				int barsAgo = CurrentBar - p.BarIndex;
					if (DebugZonas)
						Log(string.Format("[Zonas] bar {0} {1} | pivote {2} @ {3} | barsAgo {4} | enVentana {5} | usado {6} | opp @ {7}",
							CurrentBar, Time[0].ToString("HH:mm"), p.IsHigh ? "HIGH(resist)" : "LOW(soporte)", p.Price, barsAgo,
							EnVentanaBar(barsAgo), pivotesUsados.Contains(p.BarIndex), opp.Price));
				if (!EnVentanaBar(barsAgo)) continue;
				if (pivotesUsados.Contains(p.BarIndex)) continue;

				bool ok = p.IsHigh ? opp.Price < p.Price : opp.Price > p.Price;
				if (!ok) continue;

				// v4.2 ESTRUCTURA: comparar el pivote del stop (opp) contra su pivote previo
				// del MISMO tipo. Compra valida solo si el minimo del stop es ASCENDENTE;
				// venta valida solo si el maximo del stop es DESCENDENTE.
				// (pivots esta ordenado del mas reciente al mas viejo)
				bool estructuraOk = false;
				for (int j = i + 2; j < pivots.Count; j++)
				{
					if (pivots[j].IsHigh == opp.IsHigh)
					{
						estructuraOk = p.IsHigh ? opp.Price > pivots[j].Price   // higher low
												: opp.Price < pivots[j].Price;  // lower high
						break;
					}
				}

				// v4.6 (regla de Luis): NO crear "zona entre zona". Si el nivel del pivote cae DENTRO del
					// rango de las S/R vigentes (hay una zona viva por encima Y otra por debajo), es interior.
					// No se marca como usada: puede crearse luego si el rango se estrecha y pasa a ser extremo.
				// El filtro 'no zona entre zona' se DESACTIVO por decision de Luis (se dibujan
				// tambien las zonas interiores). El codigo estaba con un '&& false' que dejaba la
				// condicion muerta; se elimina para que no confunda al releer el archivo.

				var z = new Zone
				{
					IsHigh        = p.IsHigh,
					Level         = p.Price,
					BodyEdge      = p.BodyEdge,
					OppositePivot = opp.Price,
					PivotBar      = p.BarIndex,
					Tag           = "Zona_" + p.BarIndex + (p.IsHigh ? "H" : "L"),
					EstructuraOK  = estructuraOk,
				EsSesionActual = Time[barsAgo].Date == Time[0].Date,
				FechaPivote    = Time[barsAgo].Date,
				YaFueRota      = pivotesRotos.Contains(p.BarIndex)
				};

				pivotesUsados.Add(p.BarIndex);
				zonasVivas.Add(z);
				// v9.2 FIX: solo dibujar dentro de la ventana. ProcesarZigZag corre TODO el dia, y el
				// ZigZag confirma pivotes con retraso: una zona creada a las 15:00 desde un pivote de
				// las 10:00 trazaba un rectangulo de 5 horas de ancho que ademas quedaba en el chart
				// hasta la sesion siguiente. Fuera de la ventana la zona NO es operable (PuedeOperar
				// exige ventanaActiva), asi que dibujarla solo confunde.
				// v9.6: se dibujan TODAS las zonas vivas. Las heredadas de sesiones previas salen en
				// MORADO y con la fecha de origen, para poder auditarlas: se extienden a lo largo de
				// varias sesiones porque efectivamente siguen vivas y son operables.
				if (DrawZones && ventanaActiva) { DibujarZona(z); tagsDibujados.Add(z.Tag); }
			}
		}

		private int SafeBar(bool high, int instance, int lookback)
		{
			try { return high ? zz.HighBar(0, instance, lookback) : zz.LowBar(0, instance, lookback); }
			catch { return -1; }
		}

		private void LimpiarZonas()
		{
			// v9.7 - OJO, ESTO ES CLAVE PARA ENTENDER LA ESTRATEGIA:
			// Al cambiar de dia se vacian zonasVivas Y pivotesUsados. Como el detector sigue viendo
			// 255 barras atras, en la sesion siguiente ProcesarZigZag RECREA las mismas zonas desde
			// los pivotes de aperturas anteriores -- INCLUIDAS LAS QUE YA SE HABIAN ROTO, porque el
			// estado 'rota' no sobrevive al cambio de dia.
			// pivotesRotos SI persiste, pero es puramente informativo (color del rectangulo).
			// Los rectangulos ya dibujados se conservan en el chart como historial visual.
			tagsDibujados.Clear();
			zonasVivas.Clear();
			pivotesUsados.Clear();
		}

		private void CancelarOrdenSiExiste()
		{
			if (ordenStop != null && (ordenStop.OrderState == OrderState.Working || ordenStop.OrderState == OrderState.Accepted))
				CancelOrder(ordenStop);
			ordenStop = null;
		}

		// Valida SOLO LA HORA del pivote, deliberadamente -- no su fecha.
		// De aqui nace la memoria entre sesiones: un pivote formado entre 09:30 y 10:30 es valido
		// aunque sea de una sesion anterior, mientras siga dentro del alcance del detector
		// (255 barras ~ 3 sesiones previas en 5 min). Es el rasgo que distingue a esta estrategia
		// de una ruptura de apertura convencional, y esta medido: sin las zonas heredadas el
		// PF cae de 1,38 a 1,19 y el Net/DD de 6,41 a 1,95.
		// NO anadir comprobacion de fecha aqui.
		private bool EnVentanaBar(int barsAgo)
		{
			if (barsAgo < 0 || barsAgo > CurrentBar) return false;
			return EnRangoHorario(Time[barsAgo].TimeOfDay);
		}

		// v4: la vela ACTUAL (ya cerrada) rompe una zona viva -> orden stop en su extremo (+1 tick).
		private void RevisarRupturas()
		{
			Zone zonaConsumida = null;

			foreach (var z in zonasVivas.OrderByDescending(zo => zo.PivotBar).ToList())
			{
				if (CurrentBar - z.PivotBar < 1) continue;
				// v9.5: NO se filtra por sesion. Las zonas de la ventana de apertura de sesiones
				// PREVIAS tambien son operables: es el comportamiento con el que se validaron las
				// fases A-D y aporta las mejores operaciones del sistema (~$111/trade contra $49 de
				// media). Ver el bloque v9.5 de la cabecera antes de tocar esto.

				if (z.IsHigh) // resistencia -> compra
				{
					if (!TradeLongs) continue;
					// v4.7 (regla de Luis): rompe con que SUPERE la zona, no hace falta cierre por encima.
					// Basta que el high supere el nivel (borde superior de la resistencia).
					if (High[0] <= z.Level) continue;

					// v4.6 (regla de Luis): el STOP va en el PIVOTE ANTERIOR mas cercano a la ruptura (el
					// swing confirmado mas reciente bajo el nivel). Fallback al opuesto de la zona si no hay.
					double soporte = z.OppositePivot;
					double reciente = PivoteAnteriorRuptura(true, z.Level);
					if (!double.IsNaN(reciente)) soporte = reciente;

					// v4.7 (regla de Luis): la vela de ruptura no puede ALEJARSE del nivel mas que la MITAD
					// de la distancia zona -> PIVOTE ANTERIOR MAS CERCANO (el mismo del SL, no el opuesto de
					// la zona). Se mide del nivel al extremo (high) de la vela. Si se aleja mas -> descartar.
					double maxDist = (z.Level - soporte) * MaxBreakoutRatio;
					if ((High[0] - z.Level) > maxDist) continue;

					// v4.5: el precio de entrada depende del modo.
					double precioOrden;
					// v7.0: entrada SIEMPRE por stop sobre el extremo de la vela de ruptura.
					// RetestNivel descartado: 0 de 104 combinaciones supero PF 1,00 (mediana 0,856).
					precioOrden = High[0] + TickSize;

					double stopPrice   = soporte - StopOffsetPoints;
					double riskPts     = precioOrden - stopPrice;
					double tpProyectado = precioOrden + riskPts * RiskReward;

					// v5.4 CONFIRMACION DE MOMENTUM: ¿la vela que rompe tiene fuerza real?
					// Va aqui, antes de estructura y camino limpio, porque si la ruptura es debil
					// el resto del contexto da igual. Los 3 sub-filtros estan OFF por defecto.
					string motivoMomLONG;
					if (!MomentumValido(true, out motivoMomLONG))
					{
						if (DebugZonas)
							Log(string.Format("[ZigZag] {0} LONG saltado nivel {1}: MOMENTUM ({2}).",
								Time[0].ToString("HH:mm"), z.Level, motivoMomLONG));
						continue;
					}

					// v4.6 FILTRO ESTRUCTURA (regla de Luis): el pivote donde va el STOP (el mismo que usa
					// PivoteAnteriorRuptura) debe ser un minimo ASCENDENTE (higher low). Si es mas bajo que
					// su anterior = desgaste en la subida -> NO es compra valida. SEGUIR ITERANDO (continue).
					if (UseStructureFilter && !EstructuraValidaSL(true, z.Level))
					{
						Log(string.Format("[ZigZag] {0} LONG saltado nivel {1} ({2}): FILTRO ESTRUCTURA (pivote del SL NO es minimo ascendente).", Time[0].ToString("HH:mm"), z.Level, z.Tag));
						continue;
					}
					// FILTRO CAMINO LIMPIO: ninguna zona previa entre la entrada y el target -> sigo iterando
					if (UseCleanPathFilter && CaminoObstruido(true, precioOrden, tpProyectado, z))
					{
						Log(string.Format("[ZigZag] {0} LONG saltado nivel {1} ({2}): FILTRO CAMINO LIMPIO (zona previa obstruye el target).", Time[0].ToString("HH:mm"), z.Level, z.Tag));
						continue;
					}

					int qty = CalcularContratos(riskPts);
					zonaConsumida = z;
					if (qty >= 1)
						EnviarOrden(true, false, precioOrden, stopPrice, riskPts, qty);
					else
						Log(string.Format("[ZigZag] Setup LARGO descartado: riesgo de 1 contrato (${0:F0}) supera el limite (${1:F0}).",
							riskPts * Instrument.MasterInstrument.PointValue, RiesgoMaximoUSD));
					break;
				}
				else // soporte -> venta
				{
					if (!TradeShorts) continue;
					// v4.7 (regla de Luis): rompe con que SUPERE la zona (el low perfora el nivel), sin exigir cierre.
					if (Low[0] >= z.Level) continue;

					// v4.6 (regla de Luis): STOP en el PIVOTE ANTERIOR mas cercano a la ruptura (swing
					// confirmado mas reciente por encima del nivel). Fallback al opuesto de la zona si no hay.
					double resistencia = z.OppositePivot;
					double reciente = PivoteAnteriorRuptura(false, z.Level);
					if (!double.IsNaN(reciente)) resistencia = reciente;

					// v4.7 (regla de Luis): la vela de ruptura no puede alejarse del nivel mas que la MITAD
					// de la distancia zona -> PIVOTE ANTERIOR MAS CERCANO (el del SL, no el opuesto de la zona).
					double maxDist = (resistencia - z.Level) * MaxBreakoutRatio;
					if ((z.Level - Low[0]) > maxDist) continue;

					// v4.5: el precio de entrada depende del modo.
					double precioOrden;
					// v7.0: idem LONG, stop bajo el low de la vela de ruptura.
					precioOrden = Low[0] - TickSize;

					double stopPrice   = resistencia + StopOffsetPoints;
					double riskPts     = stopPrice - precioOrden;
					double tpProyectado = precioOrden - riskPts * RiskReward;

					
					// v5.4 CONFIRMACION DE MOMENTUM: ¿la vela que rompe tiene fuerza real?
					// Va aqui, antes de estructura y camino limpio, porque si la ruptura es debil
					// el resto del contexto da igual. Los 3 sub-filtros estan OFF por defecto.
					string motivoMomSHORT;
					if (!MomentumValido(false, out motivoMomSHORT))
					{
						if (DebugZonas)
							Log(string.Format("[ZigZag] {0} SHORT saltado nivel {1}: MOMENTUM ({2}).",
								Time[0].ToString("HH:mm"), z.Level, motivoMomSHORT));
						continue;
					}

					// v4.6 FILTRO ESTRUCTURA (regla de Luis): el pivote del STOP debe ser un maximo
					// DESCENDENTE (lower high). Si es mas alto que su anterior -> NO es venta valida. Sigo iterando.
					if (UseStructureFilter && !EstructuraValidaSL(false, z.Level))
					{
						Log(string.Format("[ZigZag] SHORT saltado ({0}): pivote del SL NO es maximo descendente -> sigo iterando.", z.Tag));
						continue;
					}
					if (UseCleanPathFilter && CaminoObstruido(false, precioOrden, tpProyectado, z))
					{
						Log(string.Format("[ZigZag] SHORT saltado ({0}): zona previa obstruye el camino al target -> sigo iterando.", z.Tag));
						continue;
					}

					int qty = CalcularContratos(riskPts);
					zonaConsumida = z;
					if (qty >= 1)
						EnviarOrden(false, false, precioOrden, stopPrice, riskPts, qty);
					else
						Log(string.Format("[ZigZag] Setup CORTO descartado: riesgo de 1 contrato (${0:F0}) supera el limite (${1:F0}).",
							riskPts * Instrument.MasterInstrument.PointValue, RiesgoMaximoUSD));
					break;
				}
			}

			if (zonaConsumida != null)
				zonasVivas.Remove(zonaConsumida);

			// v4.6: dejar SOLO las zonas S/R que aun no se rompieron (regla de Luis)
			LimpiarZonasRotas();
		}

		// v4.6 (regla de Luis): el PIVOTE ANTERIOR a la ruptura. Es el swing CONFIRMADO mas reciente
		// del tipo opuesto, anterior a la vela actual, del lado correcto del nivel roto (low<nivel
		// para compra, high>nivel para venta). Suele ser MAS CERCANO que el opuesto de la zona: el
		// retroceso que se formo entre el pivote de la zona y la ruptura. Se mide el riesgo desde ahi.
		private double PivoteAnteriorRuptura(bool isLong, double nivel)
		{
			foreach (var p in pivots)   // ordenado del mas reciente al mas viejo
			{
				if (CurrentBar - p.BarIndex < 1) continue;   // debe ser anterior a la vela actual
				if (isLong  && !p.IsHigh && p.Price < nivel) return p.Price;
				if (!isLong &&  p.IsHigh && p.Price > nivel) return p.Price;
			}
			return double.NaN;
		}

		// v4.6 (regla de Luis): valida la ESTRUCTURA del pivote donde ira el STOP (el MISMO que devuelve
		// PivoteAnteriorRuptura). Compra valida solo si ese pivote (un minimo) es MAS ALTO que el minimo
		// ANTERIOR del mismo tipo (higher low); venta solo si (un maximo) es MAS BAJO que el maximo anterior
		// (lower high). Si el pivote del SL es mas bajo/alto que su anterior = desgaste -> no es entrada valida.
		private bool EstructuraValidaSL(bool isLong, double nivel)
		{
			int idxSL = -1;
			for (int k = 0; k < pivots.Count; k++)
			{
				if (CurrentBar - pivots[k].BarIndex < 1) continue;
				if (isLong  && !pivots[k].IsHigh && pivots[k].Price < nivel) { idxSL = k; break; }
				if (!isLong &&  pivots[k].IsHigh && pivots[k].Price > nivel) { idxSL = k; break; }
			}
			if (idxSL < 0) return true;   // sin pivote de SL claro -> no bloquear (fallback)
			double slPrice = pivots[idxSL].Price;
			for (int j = idxSL + 1; j < pivots.Count; j++)   // pivote ANTERIOR del mismo tipo (mas viejo)
			{
				if (pivots[j].IsHigh == pivots[idxSL].IsHigh)
					return isLong ? slPrice > pivots[j].Price : slPrice < pivots[j].Price;
			}
			return true;   // sin pivote previo comparable -> no bloquear
		}

		// v4.6 (regla de Luis): "solo deja las zonas S/R que aun NO son rotas". Cada barra elimina
		// las zonas que el precio ya cerro rebasando (resistencia con Close>Level, soporte con
		// Close<Level). Evita operar niveles ya vencidos y no deja zonas "en medio" del rango vivo.
		/// <summary>
		/// v9.7 - SOLO VISUAL. Recorre las zonas vivas y anota cuales ha perforado ya el precio.
		/// No las elimina ni cambia ninguna decision de trading: unicamente permite pintarlas
		/// distinto para auditar el comportamiento descrito en la cabecera.
		/// </summary>
		private void MarcarZonasPerforadas()
		{
			for (int k = 0; k < zonasVivas.Count; k++)
			{
				var z = zonasVivas[k];
				if (z.YaFueRota) continue;
				bool perforada = z.IsHigh ? Close[0] > z.Level : Close[0] < z.Level;
				if (perforada) { z.YaFueRota = true; pivotesRotos.Add(z.PivotBar); }
			}
		}

		private void LimpiarZonasRotas()
		{
			for (int k = zonasVivas.Count - 1; k >= 0; k--)
			{
				var z = zonasVivas[k];
				bool rota = z.IsHigh ? Close[0] > z.Level : Close[0] < z.Level;
				if (rota)
				{
					// v9.3: ANTES se hacia RemoveDrawObject(z.Tag) aqui, lo que borraba del chart
					// justo la zona que acababa de romperse -- es decir, la que produjo la entrada.
					// Por eso faltaban rectangulos en los puntos de ruptura. Ahora el dibujo se
					// conserva: la zona sale de la lista operativa pero queda visible para auditar
					// la operacion a ojo.
					zonasVivas.RemoveAt(k);
				}
			}
		}

		// v4.3: PIVOTE ANTICIPADO. El ZigZag confirma los pivotes con retraso: en la vela de
		// ruptura, el swing del retroceso previo puede no estar confirmado aun, pero las velas
		// ya lo dibujaron. Para una COMPRA: el minimo de las velas entre el ultimo pivote ALTO
		// confirmado y la vela actual = el pivote bajo en formacion (el stop correcto).
		// Devuelve NaN si no hay retroceso entre el pivote y la ruptura.
		// v4.2: ¿alguna OTRA zona viva (banda completa: mecha a cuerpo) se interpone entre
		// la entrada y el take profit proyectado? Si si, el camino no esta limpio.
		private bool CaminoObstruido(bool isLong, double entrada, double target, Zone zonaOperada)
		{
			foreach (var z in zonasVivas)
			{
				if (z == zonaOperada) continue;
				double top = Math.Max(z.Level, z.BodyEdge);
				double bot = Math.Min(z.Level, z.BodyEdge);
				if (isLong)
				{
					// obstruye si la banda toca el tramo (entrada, target)
					if (bot < target && top > entrada) return true;
				}
				else
				{
					if (top > target && bot < entrada) return true;
				}
			}
			return false;
		}

		// Sizing: contratos = floor(RiesgoMaximoUSD / (distancia_al_stop x valor_del_punto)).
		// Si el riesgo de UN solo contrato ya supera el tope, devuelve 0 y el setup se DESCARTA.
		// OJO: por eso este parametro no es solo un regulador de tamano, tambien filtra que
		// setups se admiten (con $300 entran 363 operaciones; con $500, 376). Ver bloque v9.1.
		private int CalcularContratos(double riesgoPuntos)
		{
			if (riesgoPuntos <= 0) return 0;
			double valorPorPunto = Instrument.MasterInstrument.PointValue;
			double riesgoPorContrato = riesgoPuntos * valorPorPunto;
			if (riesgoPorContrato <= 0) return 0;

			double techo = RiesgoMaximoUSD;   // v9.2: margen de tolerancia eliminado (siempre 0)
			return (int)Math.Floor(techo / riesgoPorContrato);
		}

		// v4.5: envia la orden de ENTRADA como limite (retest) o stop (modo viejo).
		private void EnviarOrden(bool isLong, bool isLimit, double precioOrden, double stopPriceTeorico, double riskPts, int qty)
		{
			riesgoActivo    = riskPts;
			barraEnvioOrden = CurrentBar;
			esLargo         = isLong;
			qtyPendiente    = qty;      // v4.5: para el backup a mercado si el retest no llega
			esOrdenLimit    = isLimit;
			entradaTeorica  = precioOrden;   // para el trade ideal si la orden es rechazada

			// v4.1: solo guardamos los niveles; las ordenes SL/TP reales se envian en
			// OnExecutionUpdate cuando la entrada se LLENA (nunca antes).
			// v4.5: slPivote es el stop en el pivote opuesto (fijo, independiente del precio de fill).
			slTeorico = stopPriceTeorico;
			slPivote  = stopPriceTeorico;
			tpTeorico = isLong ? precioOrden + riskPts * RiskReward
							   : precioOrden - riskPts * RiskReward;

			if (isLong)
			{
				if (isLimit) EnterLongLimit(qty, precioOrden, "L");
				else EnterLongStopMarket(qty, precioOrden, "L");
			}
			else
			{
				if (isLimit) EnterShortLimit(qty, precioOrden, "S");
				else EnterShortStopMarket(qty, precioOrden, "S");
			}

			Log(string.Format("[ZigZag] Orden {0} {1} x{2} @ {3} | SL pivote {4} | TP teorico {5} | riesgo {6:F2} pts (${7:F0}/contrato)",
				isLong ? "LONG" : "SHORT", isLimit ? "LIMIT(retest)" : "STOP", qty, precioOrden, slPivote, tpTeorico,
				riskPts, riskPts * Instrument.MasterInstrument.PointValue));

			if (modoVisual && DrawZones)
			{
				string tag = "Trig_" + CurrentBar;
				Draw.Line(this, tag, false, 0, precioOrden, -5, precioOrden, Brushes.Orange, DashStyleHelper.Dash, 2);
				tagsDibujados.Add(tag);
			}
		}

		// Ciclo de vida de la orden stop de entrada ("L"/"S")
		protected override void OnOrderUpdate(Order order, double limitPrice, double stopPrice,
			int quantity, int filled, double averageFillPrice, OrderState orderState,
			DateTime time, ErrorCode error, string comment)
		{
			if (order == null) return;
			if (order.Name != "L" && order.Name != "S") return;

			// Entrada RECHAZADA por el broker (ej. el precio ya paso el trigger del STOP):
			if (orderState == OrderState.Rejected && Position.MarketPosition == MarketPosition.Flat)
			{
				if (!esOrdenLimit) reintentarComoLimit = true;   // era STOP -> reintentar como LIMIT esperando el retest
				else               MarcarTradeIdeal();           // el LIMIT tambien fallo (rechazo genuino, ej. limite de PJ)
			}

			if (orderState == OrderState.Working || orderState == OrderState.Accepted)
				ordenStop = order;
			else if (orderState == OrderState.Filled
				|| orderState == OrderState.Cancelled
				|| orderState == OrderState.Rejected)
				ordenStop = null;
		}

		// Dibuja el triangulo de ENTRADA en el fill y, al cerrar, el de SALIDA + resultado del trade.
		// Se detecta por cambio de posicion (persiste al cambiar de temporalidad, a diferencia de OnExecutionUpdate).
		private void DibujarMarcadoresEjecucion()
		{
			MarketPosition pos = Position.MarketPosition;

			// ENTRADA nueva: guardar niveles reales (SL/TP ya fijados en OnExecutionUpdate) y calcular $ riesgo/beneficio
			if (posPrevia == MarketPosition.Flat && pos != MarketPosition.Flat)
			{
				entradaBar    = CurrentBar;
				entradaPrecio = Position.AveragePrice;
				slTrade       = activeSL;
				tpTrade       = activeTP;
				qtyTrade      = Position.Quantity;
				double pv     = Instrument.MasterInstrument.PointValue;
				riskUSD       = Math.Abs(entradaPrecio - slTrade) * qtyTrade * pv;
				// FIX v9.1: con ModoSalida.CierreSesion activeTP=0, y |0 - entrada| daba el PRECIO
				// entero como 'beneficio' (~$58.000 en MNQ). Sin target el reward no esta definido.
				rewardUSD     = tpTrade > 0 ? Math.Abs(tpTrade - entradaPrecio) * qtyTrade * pv : 0;
				tradeVivo     = true;
			}

			// Mientras el trade este vivo (incluida su barra de cierre): box entrada(naranja)/TP(verde)/SL(rojo) + $
			if (modoVisual && tradeVivo && entradaBar > 0)
			{
				int ba = CurrentBar - entradaBar;

				// ===== FIX v9.1 - LA LINEA VERTICAL QUE BAJABA HASTA PRECIO CERO =====
				// El default validado es ModoSalida.CierreSesion, que NO pone target -> activeTP = 0.
				// El codigo dibujaba igual el conector vertical de slTrade a tpTrade, o sea del stop
				// HASTA EL PRECIO 0: una linea vertical atravesando el grafico entero. Lo mismo con la
				// linea horizontal del TP y su etiqueta, que aterrizaban en cero.
				bool hayTarget = tpTrade > 0;

				// conector VERTICAL en la vela de entrada. Sin target va del SL a la ENTRADA.
				double extremoConector = hayTarget ? tpTrade : entradaPrecio;
				Draw.Line(this, "trVert" + entradaBar, false, ba, slTrade, ba, extremoConector, Brushes.Gray, DashStyleHelper.Solid, 1);

				// niveles horizontales (terminan en la vela actual)
				Draw.Line(this, "trEnt" + entradaBar, false, ba, entradaPrecio, 0, entradaPrecio, Brushes.Orange, DashStyleHelper.Solid, 1);
				Draw.Line(this, "trSl"  + entradaBar, false, ba, slTrade,       0, slTrade,       Brushes.Red,    DashStyleHelper.Solid, 2);
				Draw.Text(this, "trSlT" + entradaBar, string.Format("-${0:F0}", riskUSD), -4, slTrade, Brushes.Red);

				// TP solo si existe de verdad (modo TargetFijo)
				if (hayTarget)
				{
					Draw.Line(this, "trTp"  + entradaBar, false, ba, tpTrade, 0, tpTrade, Brushes.LimeGreen, DashStyleHelper.Solid, 2);
					Draw.Text(this, "trTpT" + entradaBar, string.Format("+${0:F0}", rewardUSD), -4, tpTrade, Brushes.LimeGreen);
				}

				if (pos == MarketPosition.Flat)   // se cerro el trade -> fijar el box y mostrar el resultado real
				{
					tradeVivo = false;
					double pnl = SystemPerformance.AllTrades.Count > 0
						? SystemPerformance.AllTrades[SystemPerformance.AllTrades.Count - 1].ProfitCurrency : 0;
					Draw.Text(this, "trRes" + entradaBar, string.Format("{0} ${1:F0}", pnl >= 0 ? "WIN" : "LOSS", pnl),
						-4, entradaPrecio, pnl >= 0 ? Brushes.LimeGreen : Brushes.Red);
				}
			}

			posPrevia = pos;
		}

		// Registra un trade IDEAL cuando la orden de entrada fue rechazada (no se opero de verdad).
		private void MarcarTradeIdeal()
		{
			idealActivo     = true;
			idealEsLargo    = esLargo;
			idealEntrada    = entradaTeorica;
			idealStop       = slPivote;
			idealTarget     = tpTeorico;
			idealBar        = CurrentBar;
			idealEntryDrawn = false;
			Log(string.Format("[ZigZag] Entrada RECHAZADA -> trade IDEAL {0} @ {1} (SL {2} / TP {3}). El bot sigue buscando.",
				idealEsLargo ? "LONG" : "SHORT", idealEntrada, idealStop, idealTarget));
		}

		// Dibuja la entrada ideal y, al tocar stop o target, la salida ideal donde HABRIA cerrado. Solo visual.
		private void ActualizarTradeIdeal()
		{
			if (!modoVisual) return;   // v5.3
			if (!idealEntryDrawn)
			{
				int ba = Math.Max(0, CurrentBar - idealBar);
				if (idealEsLargo) Draw.TriangleUp(this, "idIn" + idealBar, false, ba, Low[ba] - 3 * TickSize, Brushes.Goldenrod);
				else              Draw.TriangleDown(this, "idIn" + idealBar, false, ba, High[ba] + 3 * TickSize, Brushes.Goldenrod);
				idealEntryDrawn = true;
			}

			// FIX v9.1: en ModoSalida.CierreSesion el trade real NO tiene target, asi que el
			// 'ideal' no puede cerrarse en uno: estaria dibujando una estrategia distinta a la que
			// se opera. Sin target cierra por stop o al terminar la sesion.
			bool hayTargetIdeal = Salida == ModoSalida.TargetFijo;
			bool loss, win;
			if (idealEsLargo) { loss = Low[0]  <= idealStop; win = hayTargetIdeal && High[0] >= idealTarget; }
			else              { loss = High[0] >= idealStop; win = hayTargetIdeal && Low[0]  <= idealTarget; }
			bool finSesion = !hayTargetIdeal && Bars.IsFirstBarOfSession && CurrentBar > idealBar;

			if (loss || win || finSesion)
			{
				double salida = loss ? idealStop : (win ? idealTarget : Close[1]);   // si ambos en la misma vela -> gana el STOP (peor caso)
				Brush  col    = loss ? Brushes.Red : Brushes.LimeGreen;
				if (finSesion) col = Brushes.Goldenrod;
				if (idealEsLargo) Draw.TriangleDown(this, "idOut" + idealBar, false, 0, High[0] + 3 * TickSize, col);
				else              Draw.TriangleUp(this, "idOut" + idealBar, false, 0, Low[0] - 3 * TickSize, col);
				Draw.Line(this, "idLn" + idealBar, false, CurrentBar - idealBar, idealEntrada, 0, salida, col, DashStyleHelper.Dot, 1);
				Log(string.Format("[ZigZag] Trade IDEAL cerrado en {0}. Entrada {1} -> salida {2}.",
					loss ? "STOP" : "TARGET", idealEntrada, salida));
				idealActivo = false;
			}
		}

		// v4.1: al llenarse la ENTRADA, colocar las ordenes SL/TP explicitas de inmediato.
		//  - Trigger:  SL en el pivote opuesto (slTeorico), TP teorico desde el trigger.
		//  - FillReal: SL/TP recalculados desde el precio real del fill.
		// Guardia: si el precio ya rebaso el stop al momento del fill (gap/latencia), salir a mercado.
		protected override void OnExecutionUpdate(Execution execution, string executionId, double price,
			int quantity, MarketPosition marketPosition, string orderId, DateTime time)
		{
			if (execution == null || execution.Order == null) return;
			if (execution.Order.OrderState != OrderState.Filled) return;

			string name = execution.Order.Name;
			if (name != "L" && name != "S") return;   // solo la entrada

			bool isLong = name == "L";
			// v4.5: el stop SIEMPRE va en el pivote opuesto (slPivote), pase lo que pase con el fill.
			// El riesgo real se mide desde el precio EJECUTADO hasta el pivote -> TP correcto tanto
			// para el retest (fill ~= nivel) como para el backup a mercado (fill mas alejado).
			activeSL = slPivote;
			double riskReal = Math.Abs(price - slPivote);
			if (Salida == ModoSalida.CierreSesion)
				activeTP = 0;   // v8.0: sin target. Solo stop; sale por SL o por cierre de sesion.
			else
				activeTP = tpTeorico;   // v9.2: RefPrecio eliminado (inerte con CierreSesion)

			int qty = Position.Quantity > 0 ? Position.Quantity : quantity;

			if (isLong)
			{
				if (price <= activeSL) { ExitLong("SL_Emergencia", "L"); return; }
				ExitLongStopMarket(0, true, qty, activeSL, "SL", "L");
				if (activeTP > 0) ExitLongLimit(0, true, qty, activeTP, "TP", "L");
			}
			else
			{
				if (price >= activeSL) { ExitShort("SL_Emergencia", "S"); return; }
				ExitShortStopMarket(0, true, qty, activeSL, "SL", "S");
				if (activeTP > 0) ExitShortLimit(0, true, qty, activeTP, "TP", "S");
			}

			Log(string.Format("[ZigZag] FILL {0} x{1} @ {2} -> SL {3} | TP {4} | riesgo total ${5:F0}",
				name, qty, price, activeSL, activeTP,
				Math.Abs(price - activeSL) * qty * Instrument.MasterInstrument.PointValue));
		}

		private bool PuedeOperar()
		{
			if (!ventanaActiva) return false;
			if (OneTradePerDay && ContarTradesHoy() >= 1) return false;
			return true;
		}

		// v5.3: gate central de logging. En optimizacion (sin chart y sin DebugZonas) no se emite nada.
		/// <summary>
		/// v5.4 - CONFIRMACION DE MOMENTUM sobre la vela que rompe la zona.
		/// Los tres filtros de calidad previos (camino limpio, estructura) miran el CONTEXTO;
		/// ninguno mira si la ruptura tiene fuerza. Estos tres si:
		///   1. Volumen  : participacion real detras del movimiento.
		///   2. Rango    : la vela se expande respecto al ATR (no es una ruptura de goteo).
		///   3. Cierre   : el precio cierra en la parte fuerte de la vela, no la devuelve entera.
		/// Cualquiera puede activarse por separado para medir su aporte aislado.
		/// </summary>
		private bool MomentumValido(bool esLargo, out string motivo)
		{
			motivo = null;

			// Unico filtro de momentum que sobrevivio a la validacion (v6.0):
			// exige que la vela que rompe cierre en la parte FUERTE de su rango.
			// Descarta la ruptura que se da la vuelta dentro de la misma vela.
			// Meseta 0,30-0,50 | t de discriminacion 4,29 | solo sacrifica 14 trades de 886.
			// Los filtros por VOLUMEN y por EXPANSION DE RANGO quedaron descartados:
			//   volumen  -> pico aislado (PF 1,216 en 1,25 y 1,100 en 1,50); a 1,5 el filtro
			//               eliminaba trades MEJORES que los que conservaba (t_discrim -0,23).
			//   rango    -> colapso a PF 0,998 pegado al maximo. Ruido.
			double rango = High[0] - Low[0];
			if (rango <= 0) { motivo = "vela sin rango"; return false; }

			double fuerza = esLargo ? (Close[0] - Low[0]) / rango : (High[0] - Close[0]) / rango;
			if (fuerza < MomCierreMin)
			{
				motivo = string.Format("CIERRE debil {0:P0} < {1:P0} del rango", fuerza, MomCierreMin);
				return false;
			}
			return true;
		}

		/// <summary>
		// (v9.2: el BREAKEVEN se elimino. Barrido 0,5/1,0/1,5/2,0 R -> net $9.596/$10.140/
		//  $9.725/$11.133, todos por debajo de los $12.422 sin aplicarlo, y el Net/DD mejoraba
		//  monotonamente cuanto mas tarde se activaba: el maximo era NO aplicarlo.)


		private void Log(string mensaje)
		{
			if (logsActivos) Print(mensaje);
		}

		private int ContarTradesHoy()
		{
			int count = 0;
			DateTime hoy = Time[0].Date;
			var trades = SystemPerformance.AllTrades;
			for (int i = trades.Count - 1; i >= 0; i--)
			{
				if (trades[i].Exit.Time.Date == hoy) count++;
				else break;
			}
			return count;
		}

		#region Inputs

		[NinjaScriptProperty]
		[Range(0, 14400)]
		[Display(Name = "Segundos antes del cierre para aplanar", Order = 9, GroupName = "2. Riesgo")]
		public int SegundosAplanado { get; set; }

		[NinjaScriptProperty]
		[Range(0.1, 5.0)]
		[Display(Name = "Max alcance vela ruptura (x dist zona-pivote cercano)", Description = "La vela que rompe la zona no puede ALEJARSE (del nivel al extremo: low en venta, high en compra) mas que esta fraccion de la distancia entre la zona y el PIVOTE ANTERIOR MAS CERCANO (el mismo del SL). 0.5 = la mitad (regla de Luis). Si se aleja mas, se descarta.", GroupName = "1. Patron", Order = 1)]
		public double MaxBreakoutRatio { get; set; }

		[NinjaScriptProperty]
		[Range(0.0, double.MaxValue)]
		[Display(Name = "Stop offset (puntos)", GroupName = "2. Riesgo", Order = 0)]
		public double StopOffsetPoints { get; set; }

		[NinjaScriptProperty]
		[Range(0.1, 10.0)]
		[Display(Name = "Reward:Risk", GroupName = "2. Riesgo", Order = 1)]
		public double RiskReward { get; set; }

		[NinjaScriptProperty]
		[Range(50.0, double.MaxValue)]
		[Display(Name = "Riesgo maximo por trade (USD)", GroupName = "2. Riesgo", Order = 3)]
		public double RiesgoMaximoUSD { get; set; }

		[NinjaScriptProperty]
		[Range(1, 60)]
		[Display(Name = "Expiracion de la orden (velas)", GroupName = "3. Timing", Order = 0)]
		public int BarrasExpiracionOrden { get; set; }

		[NinjaScriptProperty]
		[Display(Name = "Filtro camino limpio al target", GroupName = "3b. Filtros de calidad", Order = 0)]
		public bool UseCleanPathFilter { get; set; }

		[NinjaScriptProperty]
		[Display(Name = "Filtro estructura de pivotes (HL/LH)", GroupName = "3b. Filtros de calidad", Order = 1)]
		public bool UseStructureFilter { get; set; }

		[NinjaScriptProperty]
		[Display(Name = "Operar largos (compras)", GroupName = "4. Direccion", Order = 0)]
		public bool TradeLongs { get; set; }

		[NinjaScriptProperty]
		[Display(Name = "Operar cortos (ventas)", GroupName = "4. Direccion", Order = 1)]
		public bool TradeShorts { get; set; }

		[NinjaScriptProperty]
		[Range(0, 23)]
		[Display(Name = "Inicio ventana - Hora (chart)", GroupName = "5. Horario", Order = 0)]
		public int SessionStartHour { get; set; }

		[NinjaScriptProperty]
		[Range(0, 59)]
		[Display(Name = "Inicio ventana - Minuto", GroupName = "5. Horario", Order = 1)]
		public int SessionStartMinute { get; set; }

		[NinjaScriptProperty]
		[Range(0, 23)]
		[Display(Name = "Fin ventana - Hora (chart)", GroupName = "5. Horario", Order = 2)]
		public int SessionEndHour { get; set; }

		[NinjaScriptProperty]
		[Range(0, 59)]
		[Display(Name = "Fin ventana - Minuto", GroupName = "5. Horario", Order = 3)]
		public int SessionEndMinute { get; set; }

		[NinjaScriptProperty]
		[Display(Name = "Un solo trade por dia", GroupName = "5. Horario", Order = 4)]
		public bool OneTradePerDay { get; set; }

		[NinjaScriptProperty]
		[Display(Name = "Dibujar zonas en chart", GroupName = "6. Visual", Order = 0)]
		public bool DrawZones { get; set; }

		[NinjaScriptProperty]
		[Display(Name = "Debug zonas (Output)", Description = "Registra en la ventana Output por que se crea o se salta cada zona de pivote. Solo para diagnostico.", GroupName = "6. Visual", Order = 1)]
		public bool DebugZonas { get; set; }

		// ---------- v5.0: filtros de regimen ----------

		// ---------- v5.1: LIMITES DIARIOS ----------

		// ---------- v5.1: FILTRO DIA DE SEMANA ----------

		// ---------- v5.2 ----------

		// ---------- v5.4: CONFIRMACION DE MOMENTUM EN LA RUPTURA ----------

		[NinjaScriptProperty]
		[Range(0.0, 1.0)]
		[Display(Name = "  Cierre minimo (fraccion del rango)", Description = "0.60 = el cierre en el 40% superior. Barrer 0.5 / 0.6 / 0.7 / 0.8", GroupName = "10. Momentum ruptura", Order = 7)]
		public double MomCierreMin { get; set; }

		// ---------- v5.4: DESVIACION RELATIVA AL PRECIO ----------

		[NinjaScriptProperty]
		[Range(0.001, 5.0)]
		[Display(Name = "ZigZag desviacion (% del precio)", Description = "Relativa al precio: se mantiene calibrada aunque el indice se multiplique. 0.02 = 0,02%. Validada en 5-min de 2015 a 2026.", GroupName = "1. Patron", Order = 0)]
		public double ZigZagDeviationPct { get; set; }

		// ---------- v8.0: ARQUITECTURA DE SALIDA ----------

		[NinjaScriptProperty]
		[Display(Name = "Modo de salida", Description = "TargetFijo: TP a RR x riesgo (validado). CierreSesion: sin target, la posicion corre hasta el cierre de sesion y solo sale por stop.", GroupName = "2. Riesgo", Order = 2)]
		public ModoSalida Salida { get; set; }

		#endregion
	}
}
