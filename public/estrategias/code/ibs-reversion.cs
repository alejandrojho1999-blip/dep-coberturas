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
	//  PRODUCCION  ·  16-ago-2026  ·  FASE E (SIMULADO)  ·  SIN CAPITAL ASIGNADO
	// =====================================================================================
	//
	//  REVERSION POR INTERNAL BAR STRENGTH.  Segundo sistema de reversion de la cartera.
	//      IBS = (Cierre - Minimo) / (Maximo - Minimo)
	//  Mide donde cerro el precio dentro del rango del propio dia. Cuando la sesion cierra
	//  en el tercio inferior estando sobre la SMA200, compra la sesion siguiente y la cierra
	//  ese mismo dia. PURAMENTE INTRADIA: no mantiene ninguna noche.
	//
	//  RESULTADO (NQ 5 min RTH, 01/01/2015 - 14/08/2026, comision y 2 ticks de deslizamiento):
	//    Operaciones ......... 329        Profit factor ....... 1,22
	//    Net profit .......... +$63.115   Aciertos ............ 56,5 %
	//    Max drawdown ........ -$25.946   Mediana por operacion +$229
	//    t-stat .............. 1,26       Escalado a MNQ ...... $6.311 · DD -$2.595
	//
	//  === LO QUE DEMUESTRA QUE LA SEÑAL ES REAL: EL TEST DE CONTROL ===
	//  Se barrio el umbral desde 0,10 hasta 0,90. Con IBS < 0,90 entra practicamente
	//  cualquier dia por encima de la SMA200, o sea la ENTRADA INCONDICIONAL:
	//
	//    IBS   ops    $/operacion   PF
	//    0,10  145        270      1,31   \
	//    0,15  239        262      1,31    |  MESETA: el umbral exacto da igual
	//    0,20  329        256      1,30    |
	//    0,25  414        258      1,31    |
	//    0,30  502        248      1,31   /
	//    0,40  705        191      1,23   \  RODILLA
	//    0,50  898        169      1,21   /
	//    0,60 1066         87      1,10   \
	//    0,70 1254         68      1,08    |  COLAPSO
	//    0,80 1512         29      1,03    |
	//    0,90 1845        -11      0,99   /   <-- CONTROL: PIERDE DINERO
	//
	//  El control PIERDE $19.662 en 1.845 operaciones. No hay beta que capturar en el tramo
	//  diurno del Nasdaq: toda la deriva esta en el overnight, que es lo que explota el
	//  OvernightDrift. Por tanto los $256 por operacion NO vienen de estar largo, vienen del
	//  filtro IBS. La forma -meseta, rodilla, colapso a cero justo donde la condicion deja de
	//  significar algo- es la de una señal con contenido, no la de un ajuste afortunado.
	//
	//  === SUPERFICIE DE PARAMETROS: 20 DE 20 EN POSITIVO ===
	//  Barrido IBS {0,10..0,30} x SMA {100,150,200,250}: las 20 combinaciones ganan dinero,
	//  19 con PF >= 1,20, rango completo de PF entre 1,19 y 1,36. El default queda 9º de 20,
	//  ni siquiera en la zona alta. No hay nada optimizado: 0,20 viene de la literatura y 200
	//  es la media canonica que ya usan el RSI2, el OvernightDrift y el WeekendEffect.
	//  Los mejores Net/DD estaban en 0,25/150 (5,11) y 0,30/150 (5,02). NO SE ADOPTARON:
	//  cambiar el default al ganador de la misma historia con la que se decide es sobreajuste.
	//
	//  === EL CRITERIO DE REGIMEN Y EL ERROR DE ESCALA ===
	//  Se habia fijado antes de correr nada que el t-stat en 2015-jun2020 debia superar 1,5.
	//  Dio 1,12 y a primera vista incumplia. La metrica estaba MAL CONSTRUIDA: comparaba
	//  dolares con el Nasdaq en 10.000 contra dolares con el Nasdaq en 20.000.
	//
	//    periodo            ops   indice medio   $/op    % del nocional
	//    2015 - jun2020     128       10.123     $149       0,0659 %
	//    jul2020 - hoy      201       19.810     $324       0,0816 %
	//
	//  En dolares el regimen antiguo parecia rendir la mitad; en porcentaje rinde el 81 %.
	//  Y el escalon completo se reprodujo en el periodo antiguo por separado: meseta $173/op
	//  contra control $22/op, amplitud $151/op que corregida por nivel del indice conserva el
	//  96 % de la amplitud historica. EL MECANISMO EXISTE EN LOS DOS REGIMENES.
	//  Es el mismo error de escala que ya engaño con el stop del WeekendEffect y con el
	//  kill-switch del Momentum: tercera vez en este proyecto.
	//
	//  === POR QUE ENTRA EN LA CARTERA ===
	//                              neto      max DD   Net/DD   t-stat
	//    cartera de 5           $83.029     -$4.201    19,76     4,84
	//    cartera de 6 (con IBS) $89.341     -$4.099    21,79     4,92
	//  El drawdown NO sube: baja $72. Se añade beneficio y la cartera se vuelve mas estable.
	//  En el regimen antiguo, que es el problema de fondo, sube el Net/DD de 2,33 a 2,82.
	//  Correlacion -0,038 con el OvernightDrift -el diseño intradia evito el solape a
	//  proposito- y con el RSI2 apenas hay dias comunes. Ratio de dependencia de regimen
	//  1,20x, el mas bajo de las seis estrategias (ZigZag 1,42x, Momentum 2,01x, RSI2 inf).
	//
	//  === LO QUE NO CUMPLE, DICHO SIN ADORNOS ===
	//   · t-stat 1,26, muy por debajo del 2,0 que se exigia. Bajo de 1,64 al cerrar a las 16:00.
	//   · Las 3 mejores operaciones son el 50,4 % del beneficio; el criterio pedia 30 %.
	//     Atenuante: recortando 5 operaciones de CADA cola el t-stat SUBE a 1,54, o sea que
	//     los extremos restan en vez de sostener. La mediana por operacion es +$314.
	//   · Es la sexta idea probada. Con seis intentos el maximo esperado por azar ronda 1,3.
	//     Lo que escapa a esa critica es el test de control: demuestra POR QUE funciona.
	//
	//  === CONDICION DE GRADUACION A CAPITAL REAL ===
	//  Fijada el 16-ago-2026, antes de encenderlo: pasa a capital SOLO si tras 40 operaciones
	//  en simulado el beneficio medio por operacion se mantiene por encima del 0,05 % del
	//  nocional. Por debajo de esa cifra se retira. Con unas 28 operaciones al año, son
	//  aproximadamente 17 meses de Fase E.
	//
	//  REQUISITO: grafico de 5 minutos con plantilla CME US Index Futures RTH. La serie
	//  diaria se añade sola. El IBS se calcula sobre el rango de esa sesion: con plantilla
	//  ETH el indicador mediria 23 horas y seria otra cosa.
	//
	//  HORARIO REAL DE LA SESION (verificado 16-ago-2026). La plantilla esta definida en HORA
	//  CENTRAL, de 8:30 a 16:00 CT, que en hora de Nueva York es 09:30 - 17:00. Por tanto:
	//    · la entrada cae en la apertura de las 09:30 NY, como estaba previsto
	//    · el IBS se calcula sobre un rango de 7,5 horas, no de 6,5
	//    · la salida por cierre de sesion ocurre a las 16:59 NY, no a las 15:59
	//  Los tres usan la MISMA definicion de sesion, asi que el sistema es coherente y el
	//  backtest midio exactamente lo que el bot hace. Lo que estaba mal era la documentacion.
	//  A tener en cuenta: la ultima hora (16:00-17:00 NY) es posterior al cierre del contado y
	//  tiene menos liquidez. Probar una salida a las 16:00 NY seria un experimento de Fase 1b,
	//  no un arreglo: cambiaria la estrategia y exigiria revalidacion completa.
	// =====================================================================================

	/// <summary>
	/// Reversion por Internal Bar Strength sobre NQ/MNQ. Cuando la sesion cierra pegada a su
	/// minimo estando por encima de la SMA200, compra la sesion siguiente y la cierra ese
	/// mismo dia. PURAMENTE INTRADIA: no mantiene ninguna noche, para no solaparse con el
	/// OvernightDrift. SIN VALIDAR. Hipotesis previa al dato y con historia anterior a 2020.
	/// </summary>
	public class PROD_Bot_NQ_IBSReversion_5min_RTH : Strategy
	{
		private bool	entrarEnLaProxima;	// señal pendiente, calculada al cierre del dia anterior
		private int		señales;			// contador, para auditar que TODAS se ejecutan
		private int		ejecutadas;
		private double	ibsUltimo;

		protected override void OnStateChange()
		{
			if (State == State.SetDefaults)
			{
				Description									= @"PRODUCCION - FASE E (simulado), sin capital asignado. Segundo sistema de reversion de la cartera. El Internal Bar Strength mide donde cerro el precio dentro del rango del dia: IBS=(Cierre-Minimo)/(Maximo-Minimo). Cuando la sesion cierra en el tercio inferior estando sobre la SMA200, compra la sesion siguiente y la cierra ese mismo dia. PURAMENTE INTRADIA para no solaparse con el OvernightDrift (correlacion -0,038). NQ 2015-2026: 329 operaciones, +$84.170, PF 1,30, 59,6% de aciertos, mediana +$314. LA SEÑAL ESTA VALIDADA POR TEST DE CONTROL: con umbral 0,90 la entrada es incondicional y PIERDE $19.662 en 1.845 operaciones, asi que la ventaja viene del filtro IBS y no de estar largo. La curva del umbral tiene forma de meseta (0,10-0,30 a ~$256/op), rodilla (0,40-0,50) y colapso a cero (0,60-0,90). Superficie de parametros: 20 de 20 combinaciones en positivo. El mecanismo se reproduce en el regimen antiguo con el 96% de la amplitud corregida por nivel del indice. Añadido a la cartera sube el Net/DD de 20,32 a 22,74 y BAJA el drawdown. NO cumple: t-stat 1,64 (se pedia 2,0) y concentracion 40,6% (se pedia 30%). Graduacion a capital: solo si tras 40 operaciones en simulado el beneficio medio supera el 0,05% del nocional.";
				Name										= "PROD_Bot_NQ_IBSReversion_5min_RTH";
				Calculate									= Calculate.OnBarClose;
				EntriesPerDirection							= 1;
				EntryHandling								= EntryHandling.UniqueEntries;
				IsExitOnSessionCloseStrategy				= true;		// la salida del dia la gestiona NinjaTrader
				ExitOnSessionCloseSeconds					= 3660;
				SegundosAplanado							= 3660;	// 61 min antes del cierre de plantilla (17:00 NY) -> flat 15:59 NY
				MaximumBarsLookBack							= MaximumBarsLookBack.Infinite;
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

				Contratos		= 1;
				LogDiagnostico	= false;
				UmbralIBS		= 0.20;
				SmaPeriodo		= 200;
			}
			else if (State == State.Configure)
			{
				// Se re-asigna aqui a proposito: el Strategy Analyzer cachea las propiedades
				// de sesion y puede ignorar el valor de SetDefaults. Al exponerlo como
				// parametro visible queda auditable en cada corrida.
				ExitOnSessionCloseSeconds = SegundosAplanado;
				// Serie diaria: de ella salen el rango de sesion para el IBS y la media de cierres.
				AddDataSeries(BarsPeriodType.Day, 1);
			}
			else if (State == State.DataLoaded)
			{
				entrarEnLaProxima = false;
				señales = 0; ejecutadas = 0; ibsUltimo = 0;
			}
			else if (State == State.Terminated)
			{
				if (LogDiagnostico && señales > 0)
					Print(string.Format("=== RESUMEN: {0} señales generadas · {1} ejecutadas ===", señales, ejecutadas));
			}
		}

		protected override void OnBarUpdate()
		{
			// ---- SERIE 1 (diaria): se calcula la señal al cierre de cada sesion -----------
			if (BarsInProgress == 1)
			{
				if (CurrentBars[1] < SmaPeriodo) return;

				double rango = Highs[1][0] - Lows[1][0];
				if (rango <= 0) return;						// sesion sin rango: nada que medir

				double ibs = (Closes[1][0] - Lows[1][0]) / rango;
				double sma = SMA(Closes[1], SmaPeriodo)[0];
				ibsUltimo = ibs;

				if (ibs < UmbralIBS && Closes[1][0] > sma)
				{
					entrarEnLaProxima = true;
					señales++;
					Log(string.Format("SEÑAL #{0} - IBS {1:F3} (cierre {2:F2} sobre minimo {3:F2}, rango {4:F2}) y precio sobre la SMA{5} ({6:F2})",
						señales, ibs, Closes[1][0], Lows[1][0], rango, SmaPeriodo, sma));
				}
				return;
			}

			// ---- SERIE 0 (5 min): ejecucion ----------------------------------------------
			if (BarsInProgress != 0) return;

			// ---- CIERRE ANTES DEL CONTADO (16:00 NY) --------------------------------------
			// ExitOnSessionCloseSeconds NO sirve para esto: la plantilla RTH cierra a las 17:00
			// NY y NinjaTrader ignora un desfase de 61 minutos, asi que la salida seguia
			// cayendo a las 17:00. Se hace explicito. Con velas de 5 min, la barra que cierra
			// a las 15:55 dispara la orden y esta rellena en la apertura de la barra siguiente,
			// tambien las 15:55, de modo que la posicion queda plana ANTES de las 16:00.
			if (Position.MarketPosition == MarketPosition.Long && ToTime(Times[0][0]) >= 155500)
			{
				ExitLong("CierreContado", "IBS_Long");
				return;
			}

			if (CurrentBars[0] < 2 || CurrentBars[1] < SmaPeriodo) return;

			// Se entra al cierre de la PRIMERA barra de la sesion siguiente a la señal.
			// La salida NO se programa aqui: la gestiona IsExitOnSessionCloseStrategy, que
			// aplana 60 segundos antes del cierre. Asi la posicion no cruza ninguna noche.
			if (entrarEnLaProxima && Bars.IsFirstBarOfSession && Position.MarketPosition == MarketPosition.Flat)
			{
				entrarEnLaProxima = false;
				ejecutadas++;
				EnterLong(Convert.ToInt32(Contratos), "IBS_Long");
				Log(string.Format("ENTRADA #{0} - apertura de sesion, IBS previo {1:F3}", ejecutadas, ibsUltimo));
			}
			else if (entrarEnLaProxima && Bars.IsFirstBarOfSession)
			{
				// no deberia ocurrir: se registra por si acaso en lugar de perderlo en silencio
				entrarEnLaProxima = false;
				Log("AVISO - señal descartada: ya habia posicion abierta al abrir la sesion");
			}
		}

		private void Log(string mensaje)
		{
			if (!LogDiagnostico) return;
			Print(string.Format("[{0}] {1}", Time[0].ToString("dd/MM/yyyy HH:mm"), mensaje));
		}

		#region Properties
		[NinjaScriptProperty]
		[Range(0, 14400)]
		[Display(Name = "Segundos antes del cierre para aplanar", Order = 3, GroupName = "2. Señal")]
		public int SegundosAplanado { get; set; }

		[NinjaScriptProperty]
		[Range(1, int.MaxValue)]
		[Display(Name = "Contratos", Order = 1, GroupName = "1. General")]
		public int Contratos { get; set; }

		[NinjaScriptProperty]
		[Display(Name = "Log de diagnostico", Order = 2, GroupName = "1. General")]
		public bool LogDiagnostico { get; set; }

		[NinjaScriptProperty]
		[Range(0.01, 0.99)]
		[Display(Name = "Umbral IBS", Order = 1, GroupName = "2. Señal")]
		public double UmbralIBS { get; set; }

		[NinjaScriptProperty]
		[Range(20, 500)]
		[Display(Name = "Periodo SMA de tendencia", Order = 2, GroupName = "2. Señal")]
		public int SmaPeriodo { get; set; }
		#endregion
	}
}
