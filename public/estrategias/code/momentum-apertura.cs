#region Using declarations
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Input;
using System.Windows.Media;
using System.Xml.Serialization;
using NinjaTrader.Cbi;
using NinjaTrader.Gui;
using NinjaTrader.Gui.Chart;
using NinjaTrader.Gui.SuperDom;
using NinjaTrader.Gui.Tools;
using NinjaTrader.Data;
using NinjaTrader.NinjaScript;
using NinjaTrader.Core.FloatingPoint;
using NinjaTrader.NinjaScript.Indicators;
using NinjaTrader.NinjaScript.DrawingTools;
#endregion

//This namespace holds Strategies in this folder and is required. Do not change it.
namespace NinjaTrader.NinjaScript.Strategies
{
	//  ---------------------------------------------------------------------------------
	//   MOMENTUM DE PRIMERA HORA  ·  MNQ  ·  30 minutos  ·  solo largos
	//  ---------------------------------------------------------------------------------
	//
	//   COMO OPERA. Entre las 09:30 y las 10:30 de Nueva York, al cierre de cada barra de
	//   30 min, compra si se cumplen las tres a la vez:
	//     1. el cierre supera la banda superior de Bollinger(20, 2.0)
	//     2. el RSI(14, suavizado 3) esta por encima de 65
	//     3. el precio esta por encima de la EMA(200)
	//   Sale por trailing de 2,0 ATR o por cierre de sesion (16:59:30 NY). Sin profit target.
//   Ese cierre es el de la plantilla RTH, que va de 8:30 a 16:00 CENTRAL = 09:30 a 17:00 NY.
	//
	//   EL TRAILING ES EL STOP. No hay stop inicial fijo: la distancia en ATR protege desde
	//   la entrada y NinjaTrader la mueve sola a favor. Por eso no existe parametro de stop:
	//   tenerlo era decorativo, nunca llegaba a ejecutarse.
	//
	//   EL KILL-SWITCH ES EL MAYOR GENERADOR DE ALFA, no una proteccion accesoria.
	//   Full sample NQ 2015-2026 (337 trades, slippage 2):
	//     OFF     -> $57,5k | PF 1,33 | DD -$24,8k | MTR 833d | perdedora media -$1.280
	//     ON 300  -> $85,3k | PF 1,77 | DD -$13,6k | MTR 491d | perdedora media   -$622
	//   Mecanica: 300 en NQ son ~15 puntos y, con barras de 30 min, equivale a 'primera barra
	//   en contra = fuera'. Amputa la cola izquierda del trailing sin tocar a los ganadores.
	//   El valor es ABSOLUTO y no escala solo -> MNQ: 30 | NQ: 300.
	//
	//   ESTADO DE LA RE-VALIDACION EN MNQ NATIVO (ago-2026). Leelo antes de operarlo.
	//   IS 2021-jun2024, MNQ 30 min RTH, comision + slippage 2:
	//     net $2.714 | PF 1,58 | DD -$1.376 | Probability 5,29% | 96 trades | avg $28,27
	//   · SUSPENDE el criterio de Probability <= 5% que se fijo ANTES de mirar resultados.
	//   · 2021 fue un anio PERDEDOR: el bot no cruza a positivo hasta agosto de ese anio.
	//   · El rango 2022-2024 daba PF 2,14 y avg $54. La diferencia es 2021 y medio 2024.
	//
	//   POR QUE NO SE PUEDE OPTIMIZAR. A 27 trades/anio y con esta dispersion, el error
	//   estandar del beneficio medio es de $13,8 sobre una media de $28,3 (+-49%). Para
	//   distinguir una mejora de $17/trade harian falta ~494 operaciones, es decir 18 anios.
	//   Grid MNQ de 81 combinaciones (BB 18/20/22 x StdDev 1,8/2,0/2,2 x RSI 60/65/70 x
	//   trail 1,5/2,0/2,5): el ganador mejora +$17,3/trade, pero el maximo esperado por PURO
	//   AZAR con solo 10 intentos independientes es +$18,8. El ganador no significa nada.
	//
	//   QUE SI QUEDO CONFIRMADO
	//   · RSI Overbought 65: optimo INTERIOR (60 -> 1,66 | 65 -> 1,79 | 70 -> 1,61).
	//   · Trail 2,0: optimo INTERIOR (1,5 -> 1,78 | 2,0 -> 1,81 | 2,5 -> 1,69).
	//   · BB 20 y StdDev 2,0: se MANTIENEN por ser valores a priori del indicador. El grid
	//     prefiere 18 / 2,2, pero ambos caen en el BORDE de la rejilla y su ventaja es ruido
	//     de seleccion. No se adoptan.
	//
	//   LIMPIEZA ago-2026. De 33 parametros quedan 17. Se elimino todo lo inerte, lo
	//   inalcanzable y lo no validado. NO reintroducir nada de esto sin pasar el pipeline:
	//     · Stop ATR Mult y Use Trailing Stop -> excluyentes en el codigo; con el trailing
	//       encendido el stop fijo NUNCA se registraba (los 5 valores daban el mismo neto).
	//     · Target ATR Mult -> siempre 0, la estrategia nunca tuvo profit target.
	//     · Break-Even completo -> CODIGO INALCANZABLE: su condicion exigia !UseTrailingStop.
	//     · Time Exit, Momentum Mode (la rama de reversion era otra estrategia sin validar).
	//     · Todo el codigo de cortos y su RSI Oversold -> cero operaciones en todo el historico.
	//     · Max Trades/Day -> inerte: con barras de 30 min en una ventana de 1 hora solo hay
	//       dos cierres, y la posicion dura hasta el cierre de sesion. Con el se fueron
	//       tradesToday y currentDay, que ya solo se escribian.
	//     · Stop/Take Profit en USD -> en este bot eran una TRAMPA: al ser excluyentes con el
	//       trailing, activarlos apagaba el mecanismo validado sin avisar. Para probar
	//       variantes de stop esta Trail ATR Mult, que es el mando correcto.
	//
	//   RESULTADO DEL OOS VIRGEN (jul2024-ago2026, MNQ 30 min RTH, comision + slippage 2):
	//     net $4.007,50 | PF 2,78 | DD -$563,90 | Net/DD 7,11 | Probability 0,26%
	//     55 trades | 52,73% aciertos | avg $72,86 | MTR 190 dias | max 4 perdedoras seguidas
	//   SUPERA el criterio fijado de antemano (PF > 1,25 con >= 40 trades). Es el primer bot
	//   de la serie cuyo OOS sale MEJOR que el IS. Pero hay que leerlo bien:
	//     · El ratio ganancia/perdida NO cambia (2,53 -> 2,49). Lo que sube es el acierto
	//       (38,5% -> 52,7%): mismo edge, REGIMEN mas favorable. Es momentum alcista puro en
	//       un mercado que sube. No esperar $72/trade en un 2022.
	//     · CONTAMINACION PARCIAL: el kill-switch de 30 se eligio en jul-2026 con una corrida
	//       MNQ 2019-2026 que INCLUYE este periodo. El resto de parametros si son virgenes.
	//     · Mas de la mitad del neto del OOS sale de los ultimos 5 meses; la mejor operacion
	//       vale el 17,5% del total.
	//   AGREGADO 2021-ago2026: 151 trades, $6.722, avg $44,51. Esa es la expectativa razonable,
	//   no los extremos de $28 (IS) ni $72 (OOS).
	//
	//   WFO DESCARTADO POR INVIABLE, no por omision. Con ventanas 548/183 cada una tendria
	//   ~40 trades para optimizar y ~14 para validar: eso no produce informacion.
	//
	//   AUDITORIA SOBRE LAS 154 OPERACIONES (ago-2026). Tres hallazgos que hay que conocer:
	//
	//   1) ANATOMIA DE LAS SALIDAS -- de aqui sale todo el dinero:
	//        Cierre de sesion  65 ops (42%)  net +$13.196  media +$203  GANADORAS LAS 65 (100%)
	//        Kill-switch       62 ops (40%)  net  -$4.011  media  -$65
	//        Trailing stop     27 ops (18%)  net  -$1.465  media  -$54
	//      O la operacion aguanta el dia entero y gana, o se corta pronto. No hay termino medio.
	//      El edge esta en comprar la ruptura correcta y NO tocarla, no en gestionar la salida.
	//      OJO: esto no prueba que el trailing sobre -- por construccion solo cierra operaciones
	//      que ya iban en contra. El barrido demuestra que si aporta y que tiene optimo interior.
	//
	//   2) EL KILL-SWITCH PIERDE SIEMPRE MAS DE LO CONFIGURADO. Limite $30, pero las 62
	//      operaciones cortadas perdieron TODAS mas de $30: mediana -$48,65, el 35% por encima
	//      de $60, peor caso -$226,40. Causa: Calculate.OnBarClose comprueba el PnL solo al
	//      cierre de cada barra de 30 min y entre dos comprobaciones el precio recorre mucho.
	//      NO es un fallo: es inevitable con barras de esa duracion. EN VIVO: no cuentes con
	//      perder $30 en un dia malo -- la cifra realista es $50-70 y el peor caso paso de $200.
	//
	//   3) CONCENTRACION SANA. Mejor operacion = 9,1% del neto. Quitando la mejor de CADA anio
	//      el sistema sigue dando +$5.204. 5 de 6 anios positivos; el unico negativo es 2022
	//      (-$98, solo 15 trades: la EMA200 lo mantuvo fuera del mercado casi todo el bear).
	//      El anio fragil es 2025 ($544, de los que el 68% viene de UNA operacion -> sin ella
	//      quedan $174). 2024 y 2026 juntos aportan el 70% del beneficio historico.
	//      El top-20 (13% de las ops) concentra el 88% del neto: perfil normal de seguidor de
	//      tendencia, pero obliga a estar encendido los dias buenos.
	//
	//   RIESGO Y GOBERNANZA
	//   · 30 minutos, no negociable. Barrido de timeframe: 5min N/DD 0,62 -> 15min 2,46 ->
	//     30min 4,40, monotono en TODAS las metricas. En 5 min el avg de $39 no cubria los
	//     ~$26 de friccion.
	//   · Template CME US Index Futures RTH. Con horario extendido cambian las barras y con
	//     ellas todos los indicadores.
	//   · 1 contrato MNQ. Stop/target en USD del usuario: OFF por defecto; si se encienden
	//     SUSTITUYEN al trailing, no se suman.
	//   · Registro: Optimizaciones/WFO_Bot_NQ_MomentumApertura_30min_RTH.xlsx + tesis (docx).
	//  ---------------------------------------------------------------------------------

	/// <summary>
	/// Momentum de primera hora en MNQ, 30 min RTH, solo largos.
	/// Ruptura de banda superior de Bollinger con RSI > 65 sobre EMA200, entre 09:30 y 10:30 NY.
	/// Trailing de 2,0 ATR como unica gestion de riesgo, sin target, con kill-switch diario.
	/// Fase E (forward en simulado) EN CURSO desde el 11-ago-2026.
	/// </summary>
	public class PROD_Bot_NQ_MomentumApertura_30min_RTH : Strategy
	{
		// Indicadores
		private Bollinger	bb;
		private RSI			rsi;
		private ATR			atr;
		private EMA			emaTrend;


		protected override void OnStateChange()
		{
				if (State == State.SetDefaults)
				{
				Description									= @"Momentum de primera hora en MNQ/NQ - GRAFICO DE 30 MIN, template CME US Index Futures RTH. Compra la ruptura de la banda superior de Bollinger entre 09:30 y 10:30 NY, con RSI(14,3) > 65 y precio sobre la EMA200. SOLO LARGOS, sin profit target: el trailing de 2,0 ATR es la unica gestion por operacion y no hay stop inicial fijo. CAMBIO 11-ago-2026: el kill-switch pasa de DOLARES ABSOLUTOS a PORCENTAJE DEL PRECIO (0,065%). Con $300 fijos cortaba el 9,0% de las operaciones en 2015-2017 y el 49,3% en 2024-2026: no era el mismo mecanismo. NQ 2015-2026 con comision y slippage 2: net $76.627, PF 1,71, DD -$9.964, Net/DD 7,69, Probability 0,04%, R2 0,88, 326 trades, t-stat 3,12. El mejor Net/DD y la Probability mas baja de la cartera. OJO REGIMEN: 2015-jun2020 da t 1,42; jul2020-hoy da t 2,86. OJO CONCENTRACION: las 20 mejores operaciones valen el 102% del neto -- sin ellas el sistema pierde dinero. DESCARTADOS con datos: Take Profit y Stop Loss en USD, Break-Even (codigo inalcanzable), Time Exit, Momentum Mode, cortos y Max Trades/Day. NO cambiar la temporalidad. FASE E EN CURSO desde el 11-ago-2026 (5 bots encendidos en simulado).";
				Name										= "PROD_Bot_NQ_MomentumApertura_30min_RTH";
				Calculate									= Calculate.OnBarClose;
				EntriesPerDirection							= 1;
				EntryHandling								= EntryHandling.AllEntries;
				IsExitOnSessionCloseStrategy				= true;
				// CIERRE FORZADO: NT8 aplana 30 s antes del cierre de sesion del template.
				// La plantilla RTH esta en hora CENTRAL (8:30-16:00 CT) => FLAT A LAS 16:59:30 hora de NY.
				// Es el buffer mas ajustado del portafolio (el ORB usa 300 s = 15:55). Validado asi,
				// pero en vivo el ultimo minuto es el de mayor volumen y peor slippage: si ves fills
				// malos al cierre, subir a 120-300 s exige re-correr el pipeline (cambia la salida).
				ExitOnSessionCloseSeconds					= 3660;
				SegundosAplanado							= 3660;	// 61 min antes del cierre de plantilla (17:00 NY) -> flat 15:59 NY
				IsFillLimitOnTouch							= false;
				MaximumBarsLookBack							= MaximumBarsLookBack.TwoHundredFiftySix;
				OrderFillResolution							= OrderFillResolution.Standard;
				Slippage									= 0;
				StartBehavior								= StartBehavior.WaitUntilFlat;
				TimeInForce									= TimeInForce.Gtc;
				TraceOrders									= false;
				RealtimeErrorHandling						= RealtimeErrorHandling.StopCancelClose;
				StopTargetHandling							= StopTargetHandling.PerEntryExecution;
				BarsRequiredToTrade							= 20;
				IsInstantiatedOnEachOptimizationIteration	= true;
				PrintTo										= PrintTo.OutputTab1;

				// ----- Parametros por defecto (config del edge validado) -----
				BBPeriod		= 20;
				BBStdDev		= 2.0;
				RSIPeriod		= 14;
				RSISmooth		= 3;
				RSIOverbought	= 65;		// optimo INTERIOR confirmado (MNQ 2021-jun2024: 60->1,66 | 65->1,79 | 70->1,61)
				ATRPeriod		= 14;

				// Filtro de tendencia: ON. Validado en Strategy Analyzer NQ 2015-2026:
				// mejora PF (1.12->1.13), avg trade y drawdown vs sin filtro.
				UseTrendFilter	= true;
				TrendEMAPeriod	= 200;

				// EDGE VALIDADO: el momentum del NQ vive en la PRIMERA HORA tras la apertura (09:30-10:30)
				UseTimeFilter	= true;
				StartTime		= 93000;	// 09:30
				EndTime			= 103000;	// 10:30 (solo la primera hora)

				// SOLO LARGOS. Los cortos nunca se han operado: cero en todos los backtests, y en NQ
				// solo fueron rentables en 2022. El codigo de cortos se elimino en la limpieza de
				// ago-2026 para no mantener una rama sin validar.
				EnableLong		= true;

				Contracts		= 1;

				// Log de diagnostico en la ventana Output. Solo actua en TIEMPO REAL:
				// backtests y optimizaciones no se ven afectados. Dejalo en true para ver
				// cada dia por que el bot entro o no entro.
				VerboseLog		= true;

				// KILL-SWITCH de portafolio. Distinto del stop ATR: el stop protege UN
				// trade, esto protege la CUENTA. Corta la jornada cuando la perdida
				// acumulada (realizada + abierta) cruza el limite. 0 = desactivado.
				// NO es solo gestion de riesgo: es el mayor generador de alfa del bot
				// (ver bloque v-2026-07-25). Valor en DOLARES ABSOLUTOS -> NQ: 300 | MNQ: 30-50.
				//
				// BARRIDO 26-jul-2026 (NQ RTH, 300-1800): meseta ancha 300-1050 y degradacion
				// clara desde 1300 (Net/DD 6.3/6.8/6.4/6.2 -> 5.0/4.6/4.0). Validado en OOS
				// virgen jul24-jul26 con 300 / 550 / 1050: los tres dan 55 trades y net casi
				// identico ($31.1k-$32.5k). 300 lidera PF (2.41), R2 (0.79) y Sortino (1.61);
				// 1050 lidera DD (-$4.4k) y Net/DD (7.36); el ranking se INVIERTE respecto al
				// full sample => es ruido, no señal. SE MANTIENE 300 (sin cambio: la carga de
				// la prueba recae sobre el cambio). Lo que importa es tener el kill ENCENDIDO
				// (PF 2.41 con vs 1.23 sin), no su valor exacto dentro de la meseta.
				// Nota: el 300 venia de un techo externo; resulto irrelevante por insensibilidad.
				//
				// VERIFICACION EN MICROS (27-jul-2026, MNQ 09-26 30min RTH 2019-2026, slippage 2):
				//   kill  30: net $6,537 | PF 1.66 | DD -$1,376 | N/DD 4.75 | Sharpe 0.23 | Prob 1.18%
				//   kill 300: net $5,577 | PF 1.39 | DD -$1,825 | N/DD 3.06 | Sharpe 0.17 | Prob 5.26%
				// En MNQ el 30 GANA EN TODO. Simetrico a la prueba en NQ, donde el 30 perdia
				// $15,760 por ser 10x demasiado apretado. Mismo parametro mal calibrado en
				// direcciones opuestas. DEFAULT = 30 (MNQ). Si alguna vez corres NQ: 300.
				// El DD predicho al escalar era -$1,360 y salio -$1,376: la conversion funciona.
				// El net queda 12% por debajo del NQ escalado porque la comision NO baja 1:10
				// (MNQ $1.90/trade contra $0.58 que daria el escalado).
				UseKillSwitch	= true;
				// KILL-SWITCH EN % DEL PRECIO (11-ago-2026). Antes eran dolares absolutos y eso
				// lo iba deformando solo. Medido sobre NQ 2015-2026 con $300 fijos:
				//    2015-2017 ->  9,0% de las operaciones cerradas por kill  ($300 = 0,175% del indice)
				//    2018-2020 -> 29,8%                                        ($300 = 0,123%)
				//    2021-2023 -> 35,6%                                        ($300 = 0,086%)
				//    2024-2026 -> 49,3%                                        ($300 = 0,062%)
				// El mecanismo mata hoy la MITAD de las operaciones y en 2015 mataba una de cada
				// once. No es el mismo bot. Y esto pesa mas que en otras estrategias porque aqui el
				// kill-switch es el mayor generador de alfa (PF 1,33 sin el contra 1,77 con el).
				//
				// 0,065% reproduce el comportamiento ACTUAL: con el NQ en 23.000 son ~15 puntos,
				// que es lo que valian los $300 de NQ / $30 de MNQ. No es reoptimizacion.
				//
				// RESULTADO DEL CAMBIO (NQ 2015-2026, mismas 326 entradas, solo cambia el kill):
				//    kill $300 fijo   -> net $73.542 | PF 1,64 | Net/DD 7,38 | Prob 0,11% | t 2,97 | MTR 664d
				//    kill 0,065%      -> net $76.627 | PF 1,71 | Net/DD 7,69 | Prob 0,04% | t 3,12 | MTR 511d
				// Mejora DISTRIBUIDA: 7 anios mejoran, 1 empeora (2020, -$1.640). Mismo drawdown.
				// Frecuencia del kill: de 9,0%->49,3% pasa a 37,2%->49,3%. Lo que queda no es deriva
				// de precio sino regimen de volatilidad.
				// El tramo 2015-jun2020 mejora de t 1,09 a t 1,42: el kill absoluto no solo derivaba,
				// es que en el periodo antiguo era DEMASIADO ANCHO y dejaba correr las perdidas.
				//
				// LIMITE CONOCIDO: un % normaliza el NIVEL del indice, no el REGIMEN de volatilidad.
				// El arreglo completo seria en multiplos de ATR (el bot ya calcula ATR(14) para el
				// trailing), pero obliga a elegir multiplicador y por tanto a barrer. NO hecho.
				MaxDailyLossPct	= 0.065;

				// ----- SALIDA -----
				// El trailing es la unica gestion de riesgo por operacion: no hay stop inicial fijo
				// ni profit target. La posicion corre hasta que el trailing la saca o hasta el cierre.
				//
				// BARRIDO MNQ 30min RTH 2021-jun2024 con los indicadores en sus valores actuales:
				//   trail 1,5 -> PF 1,78  $30/trade      trail 2,5 -> PF 1,69  $31/trade
				//   trail 2,0 -> PF 1,81  $35/trade      trail 3,5 -> PF 1,58  $28/trade
				// 2,0 es optimo INTERIOR (cae a ambos lados) y los dos barridos coinciden en que la
				// zona 3,0-4,5 es la mala. El 3,5 anterior venia de una optimizacion en NQ y no tiene
				// respaldo a priori, por eso se sustituye pese a que la mejora (+25%) no llega al
				// umbral de ruido del 30%: entre dos valores igualmente ajustados gana el que tiene
				// pico interior y consistencia entre barridos.
				TrailATRMult		= 2.0;
				}
			else if (State == State.Configure)
			{
				ExitOnSessionCloseSeconds = SegundosAplanado;	// red de seguridad, no el mecanismo principal
				// Serie de 1 minuto SOLO para cronometrar el cierre antes del contado. Con velas
				// de 30 min las barras cierran a las 15:30 y a las 16:00, asi que sin esta serie
				// la salida caeria media hora antes o justo en el cierre, nunca a las 15:59.
				AddDataSeries(BarsPeriodType.Minute, 1);
			}
			else if (State == State.DataLoaded)
			{
				bb			= Bollinger(BBStdDev, BBPeriod);
				rsi			= RSI(RSIPeriod, RSISmooth);
				atr			= ATR(ATRPeriod);
				emaTrend	= EMA(TrendEMAPeriod);

				// ----- Colores del chart (27-jul-2026) -----
				// La EMA de tendencia y las Bandas de Bollinger se pisaban visualmente porque NT8
				// dibuja ambas en azul por defecto. Se separan: bandas en gris tenue (son contexto)
				// y EMA en magenta grueso (es EL filtro que autoriza o bloquea cada entrada).
				bb.Plots[0].Brush = Brushes.SlateGray;		// banda superior (dispara la ruptura)
				bb.Plots[1].Brush = Brushes.LightSlateGray;	// media central
				bb.Plots[2].Brush = Brushes.SlateGray;		// banda inferior
				emaTrend.Plots[0].Brush = Brushes.Magenta;
				emaTrend.Plots[0].Width = 2;

				// Todo lo que la estrategia MIRA queda visible en el chart.
				AddChartIndicator(bb);			// las bandas que dispara la ruptura
				AddChartIndicator(rsi);			// panel propio: confirmacion de momentum
				AddChartIndicator(atr);			// panel propio: define stop y trailing
				if (UseTrendFilter)
					AddChartIndicator(emaTrend);		// magenta: el filtro de tendencia

			}
		}

		protected override void OnBarUpdate()
		{
			// ---- CIERRE ANTES DEL CONTADO (16:00 NY), cronometrado en la serie de 1 min ----
			// ExitOnSessionCloseSeconds no vale: la plantilla RTH cierra a las 17:00 NY y
			// NinjaTrader ignora un desfase de 61 minutos.
			if (BarsInProgress == 1)
			{
				if (Position.MarketPosition == MarketPosition.Long && ToTime(Times[1][0]) >= 155900)
					ExitLong("CierreContado", "MomLong");
				return;
			}

			if (BarsInProgress != 0)
				return;

			// Historia suficiente para todos los indicadores
			if (CurrentBar < Math.Max(BarsRequiredToTrade, Math.Max(BBPeriod, TrendEMAPeriod)))
				return;

			// ===== KILL-SWITCH =====
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
			// Se evalua antes que nada: si la perdida del dia cruza el limite, cierra
			// lo que haya abierto y bloquea nuevas entradas hasta el dia siguiente.
			// Limite del kill-switch como PORCENTAJE del precio, no en dolares fijos. Asi
			// significa lo mismo con el Nasdaq en 4.300 que en 23.000, y el mismo numero
			// sirve para NQ y para MNQ.
			double limiteKill = Close[0] * (MaxDailyLossPct / 100.0)
							* Instrument.MasterInstrument.PointValue * Contracts;
			if (UseKillSwitch && MaxDailyLossPct > 0 && DailyPnL() <= -limiteKill)
			{
				if (Position.MarketPosition == MarketPosition.Long)
					ExitLong("KillSwitch", "MomLong");
				return;
			}

			// Con posicion abierta no hay nada que gestionar: el trailing lo mueve NinjaTrader
			// y el cierre de sesion aplana a las 16:59:30 NY (16:00 CT).
			if (Position.MarketPosition != MarketPosition.Flat)
				return;

			// Filtro de sesion
			if (UseTimeFilter && !IsWithinSession())
				return;

			// Filtro de volatilidad: evita barras con ATR cero
			double atrValue = atr[0];
			if (atrValue <= 0)
				return;

			// El trailing ES la gestion de riesgo por operacion: no hay stop inicial fijo.
			int trailTicks = (int)Math.Round((atrValue * TrailATRMult) / TickSize);
			if (trailTicks < 1)
				return;

			// ===== SEÑAL: momentum al alza =====
			// Cierre sobre la banda superior de Bollinger + RSI confirmando la fuerza +
			// precio por encima de la EMA de tendencia. Las tres a la vez.
			bool longSignal = EnableLong
				&& Close[0] > bb.Upper[0]
				&& rsi.Avg[0] > RSIOverbought
				&& (!UseTrendFilter || Close[0] > emaTrend[0]);

			if (longSignal)
			{
				SetupExitsForEntry(trailTicks);
				EnterLong(Contracts, "MomLong");
				if (VerboseLog && State == State.Realtime)
					Print(string.Format("[{0}] ENTRADA LONG @ {1:F2} | RSI {2:F1} | banda sup {3:F2} | EMA{4} {5:F2} | ATR {6:F2}",
						Time[0].ToString("dd/MM/yyyy HH:mm"), Close[0], rsi.Avg[0], bb.Upper[0], TrendEMAPeriod, emaTrend[0], atrValue));
			}

			// ===== DIAGNOSTICO EN VIVO =====
			// Solo escribe en la ventana Output y SOLO en tiempo real: no toca la logica ni
			// ralentiza backtests ni optimizaciones. Se dispara al cerrar la ULTIMA barra de la
			// ventana de entrada (10:30), que es la ultima oportunidad del dia.
			if (VerboseLog && State == State.Realtime && !longSignal
				&& UseTimeFilter && ToTime(Times[0][0]) >= EndTime)
			{
				string motivos = "";
				if (Close[0] <= bb.Upper[0])
					motivos += string.Format("cierre {0:F2} no supera la banda superior {1:F2} | ", Close[0], bb.Upper[0]);
				if (rsi.Avg[0] <= RSIOverbought)
					motivos += string.Format("RSI {0:F1} no supera {1:F0} | ", rsi.Avg[0], RSIOverbought);
				if (UseTrendFilter && Close[0] <= emaTrend[0])
					motivos += string.Format("precio {0:F2} por debajo de la EMA{1} ({2:F2}) | ", Close[0], TrendEMAPeriod, emaTrend[0]);
				if (motivos == "") motivos = "sin señal (EnableLong esta en false)";
				Print(string.Format("[{0}] SIN ENTRADA hoy -> {1}",
					Time[0].ToString("dd/MM/yyyy HH:mm"), motivos.TrimEnd(' ', '|')));
			}
		}

		/// <summary>
		/// Registra el trailing ANTES de enviar la orden. Es la unica gestion de riesgo por
		/// operacion: protege desde la entrada a TrailATRMult veces el ATR y NinjaTrader lo
		/// mueve solo a favor. No hay stop inicial fijo ni profit target.
		/// </summary>
		private void SetupExitsForEntry(int trailTicks)
		{
			SetTrailStop(CalculationMode.Ticks, trailTicks);
		}


		/// <summary>True si la hora de la barra actual esta dentro de la ventana operativa.</summary>
		private bool IsWithinSession()
		{
			int now = ToTime(Times[0][0]);
			if (StartTime <= EndTime)
				return now >= StartTime && now <= EndTime;
			return now >= StartTime || now <= EndTime; // ventana que cruza medianoche
		}

		/// <summary>
		/// PnL del dia de ESTA estrategia: trades cerrados hoy + posicion abierta.
		/// Recorre los trades hacia atras y corta al primero que no sea de hoy, asi que
		/// el coste es despreciable aunque la lista tenga miles de operaciones.
		/// </summary>
		private double DailyPnL()
		{
			double pnl = 0.0;
			DateTime hoy = Time[0].Date;

			var trades = SystemPerformance.AllTrades;
			for (int i = trades.Count - 1; i >= 0; i--)
			{
				if (trades[i].Exit.Time.Date != hoy)
					break;
				pnl += trades[i].ProfitCurrency;
			}

			if (Position.MarketPosition != MarketPosition.Flat)
				pnl += Position.GetUnrealizedProfitLoss(PerformanceUnit.Currency, Close[0]);

			return pnl;
		}

		

		#region Properties
		[NinjaScriptProperty]
		[Range(0, 14400)]
		[Display(Name = "Segundos antes del cierre para aplanar", Order = 9, GroupName = "4. Salidas")]
		public int SegundosAplanado { get; set; }


		[NinjaScriptProperty]
		[Display(Name = "Log de diagnostico (Output)", Description = "Escribe en la ventana Output por que entro o no entro cada dia. Solo en tiempo real: no afecta a backtests.", Order = 1, GroupName = "5. Diagnostico")]
		public bool VerboseLog { get; set; }


		[NinjaScriptProperty]
		[Range(2, int.MaxValue)]
		[Display(Name = "BB Period", Description = "Periodo de las Bandas de Bollinger", Order = 1, GroupName = "1. Indicadores")]
		public int BBPeriod { get; set; }

		[NinjaScriptProperty]
		[Range(0.1, double.MaxValue)]
		[Display(Name = "BB StdDev", Description = "Desviaciones estandar de las Bandas", Order = 2, GroupName = "1. Indicadores")]
		public double BBStdDev { get; set; }

		[NinjaScriptProperty]
		[Range(2, int.MaxValue)]
		[Display(Name = "RSI Period", Description = "Periodo del RSI", Order = 3, GroupName = "1. Indicadores")]
		public int RSIPeriod { get; set; }

		[NinjaScriptProperty]
		[Range(1, int.MaxValue)]
		[Display(Name = "RSI Smooth", Description = "Suavizado del RSI (Avg)", Order = 4, GroupName = "1. Indicadores")]
		public int RSISmooth { get; set; }

		[NinjaScriptProperty]
		[Range(1, 100)]
		[Display(Name = "RSI Overbought", Description = "Umbral de sobrecompra", Order = 6, GroupName = "1. Indicadores")]
		public double RSIOverbought { get; set; }

		[NinjaScriptProperty]
		[Range(2, int.MaxValue)]
		[Display(Name = "ATR Period", Description = "Periodo del ATR para gestion de riesgo", Order = 7, GroupName = "1. Indicadores")]
		public int ATRPeriod { get; set; }

		[NinjaScriptProperty]
		[Range(1, int.MaxValue)]
		[Display(Name = "Contracts", Description = "Numero de contratos por entrada", Order = 4, GroupName = "2. Riesgo")]
		public int Contracts { get; set; }

		[NinjaScriptProperty]
		[Display(Name = "Use Kill Switch", Description = "Cortar la operativa del dia si la perdida acumulada cruza el limite", Order = 5, GroupName = "2. Riesgo")]
		public bool UseKillSwitch { get; set; }

		[NinjaScriptProperty]
		[Range(0.001, 10.0)]
		[Display(Name = "Max Daily Loss (% del precio)", Description = "Perdida diaria que corta la jornada, como porcentaje del precio. Invariante al instrumento y al nivel del indice: 0,065 significa lo mismo en NQ que en MNQ. 0 = desactivado.", Order = 6, GroupName = "2. Riesgo")]
		public double MaxDailyLossPct { get; set; }

		[NinjaScriptProperty]
		[Display(Name = "Use Trend Filter", Description = "Operar solo a favor de la EMA mayor", Order = 1, GroupName = "3. Filtros")]
		public bool UseTrendFilter { get; set; }

		[NinjaScriptProperty]
		[Range(2, int.MaxValue)]
		[Display(Name = "Trend EMA Period", Description = "Periodo de la EMA de tendencia", Order = 2, GroupName = "3. Filtros")]
		public int TrendEMAPeriod { get; set; }

		[NinjaScriptProperty]
		[Display(Name = "Use Time Filter", Description = "Restringir operaciones a la ventana de sesion", Order = 3, GroupName = "3. Filtros")]
		public bool UseTimeFilter { get; set; }

		[NinjaScriptProperty]
		[Range(0, 235959)]
		[Display(Name = "Start Time (HHmmss)", Description = "Inicio de la ventana operativa", Order = 4, GroupName = "3. Filtros")]
		public int StartTime { get; set; }

		[NinjaScriptProperty]
		[Range(0, 235959)]
		[Display(Name = "End Time (HHmmss)", Description = "Fin de la ventana operativa", Order = 5, GroupName = "3. Filtros")]
		public int EndTime { get; set; }

		[NinjaScriptProperty]
		[Display(Name = "Enable Long", Description = "Permitir entradas largas", Order = 6, GroupName = "3. Filtros")]
		public bool EnableLong { get; set; }

		[NinjaScriptProperty]
		[Range(0.1, double.MaxValue)]
		[Display(Name = "Trail ATR Mult", Description = "Distancia del trailing stop en multiplos de ATR", Order = 2, GroupName = "4. Salidas")]
		public double TrailATRMult { get; set; }

		#endregion
	}
}
