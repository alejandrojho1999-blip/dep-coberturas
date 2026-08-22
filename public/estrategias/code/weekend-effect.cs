#region Using declarations
using System;
using System.ComponentModel.DataAnnotations;
using System.Windows.Media;
using NinjaTrader.Cbi;
using NinjaTrader.Data;
using NinjaTrader.NinjaScript;
using NinjaTrader.NinjaScript.DrawingTools;
using NinjaTrader.NinjaScript.Indicators;
#endregion

namespace NinjaTrader.NinjaScript.Strategies
{
	/// <summary>
	/// Bot_NQ_WeekendEffect - Weekend effect del Nasdaq. GRAFICO DE 1 MINUTO, sesion ETH.
	///
	/// QUE HACE: compra el domingo a las 21:00 (hora del grafico) y cierra el lunes a las
	/// 15:00. Solo entra si el NQ esta en uptrend segun la EMA100 sobre velas DIARIAS.
	/// Stop fijo de $400 MNQ / $4000 NQ; si salta, vuelve a entrar en la misma sesion.
	///
	/// POR QUE FUNCIONA: es el efecto fin de semana clasico en indices. La apertura
	/// australiana del domingo recoge el flujo acumulado durante el cierre, y el filtro
	/// de tendencia evita comprar el rebote en mercados bajistas, que es donde el efecto
	/// se invierte.
	///
	/// CONFIG DEFINITIVA (19-jul-2026) — Analyzer 2015-2026, MNQ, 1 contrato, con comision:
	///   +$12,891 (=$1,121/año) · PF 1.58 · maxDD -$1,549 · N/DD 8.32 · R2 0.98
	///   Probability 0.07% · 285 trades · 44.9% aciertos · avg $45.23/trade
	///   peor trade -$152.90 · racha perdedora maxima 8
	///
	/// EL STOP AHORA ES UN PORCENTAJE DEL PRECIO (11-ago-2026), no dolares absolutos.
	/// El problema estaba anotado en el backlog de este mismo archivo y quedo medido:
	///
	///   periodo      ops   saltos del stop   stop en % del precio
	///   2015-2017    106        0   ( 0,0%)         2,31%
	///   2018-2020    125       10   ( 8,0%)         1,67%
	///   2021-2023    103       14   (13,6%)         1,14%
	///   2024-2026    109       22   (20,2%)         0,84%
	///
	/// Con $4.000 fijos en NQ, los mismos 200 puntos valian el 4,65% del indice en 2015 y
	/// el 0,87% hoy. La estrategia se iba volviendo cinco veces mas ajustada sola, y la
	/// deriva continua: con el Nasdaq en 40.000 el stop saltaria en un tercio de los trades.
	///
	/// El 0,87% NO es una reoptimizacion: es el valor que reproduce EXACTAMENTE el
	/// comportamiento actual (200 puntos con el NQ en ~23.000). Lo unico que cambia es que
	/// ahora no se deforma con el tiempo, y que el mismo numero sirve para NQ y para MNQ.
	///
	/// BARRIDO DE RE-ENTRADA (1 MNQ, stop $150):
	///   sin re-entrada $11,363 | inmediata $12,891 | esperar 10min $12,714 | 30min $12,606
	///   La re-entrada aporta +$1,527 (+13%) con el drawdown identico, y esperar solo
	///   empeora. Por eso esta FIJA e inmediata: no es un parametro configurable.
	///
	/// DESGLOSE POR ORDEN DE ENTRADA (2015-2026), el que fijo el tope de 2:
	///   #1: 265 trades  +$11,363.50  media $42.88   45.3% aciertos
	///   #2:  16 trades   +$1,385.10  media $86.57   43.8%  <- la MEJOR del bot
	///   #3:   4 trades     -$611.60  media -$152.90  0.0%  <- murio en stop 4 de 4
	///   #4:   1 trade        +$643    (muestra de uno, ruido con suerte)
	///   Distribucion: 94.0% de domingos con 1 entrada, 4.5% con 2, 1.1% con 3, 0.4% con 4.
	///
	/// SESION: entra domingo 21:00 y sale lunes 15:00, todo dentro de la sesion CME del
	/// lunes (18:00 dom - 17:00 lun). No cruza el cierre diario, asi que no hay riesgo
	/// de rollover ni de financiacion overnight adicional.
	///
	/// OJO: el stop esta en DOLARES ABSOLUTOS y no escala entre micro y mini.
	/// Default $400 en MNQ = 200 puntos. En NQ mini serian 20 puntos -> usar $4,000.
	///
	/// =====================================================================================
	/// v-2026-07-26 - PIPELINE COMPLETO (Fase 1a/1b + WFO 548/183 + OOS virgen + concentracion)
	/// Corrido en NQ para tener 11.5 anios de data (MNQ no existe antes de 2019). APROBADO.
	///
	/// *** CAMBIO DE CONFIG ADOPTADO: stop ancho + salida 15:00 ***
	///   ANTES: salida 15:45 | stop 1500 NQ (= 150 MNQ)  [calibre heredado, demasiado estrecho]
	///          Full sample: +$137.8k | PF 1.52 | DD -$15.6k | R2 0.93 | 453 tr | 50.6% win
	///          OOS virgen jul24-jul26: +$51.5k | PF 1.80 | DD -$15.6k | R2 0.85 | N/DD 3.31
	///   AHORA: salida 15:00 | stop 4000 NQ (= 400 MNQ)   <-- DEFAULT ACTUAL
	///          Full sample: +$154.6k | PF 1.52 | DD -$23.0k | R2 0.83 | 442 tr | 61.1% win
	///          OOS virgen jul24-jul26: +$59.9k | PF 1.77 | DD -$15.0k | R2 0.87 | N/DD 4.00
	///          MTR 91 dias (vs 119), avg $908/trade (vs $678).
	///
	/// HALLAZGO ESTRUCTURAL (el mas importante de este bot):
	///   El stop en DOLARES ABSOLUTOS no escala con el NIVEL DEL INDICE. En 2015 el NQ estaba
	///   en ~4,300 y $4,000 (200 pts) era ~4.7% del indice; hoy con NQ >23,000 es ~0.9%.
	///   Por eso el stop ancho gana +$27.9k sobre el estrecho en 2020-2026 y pierde -$11.1k
	///   en 2015-2019: no son dos estrategias, es el mismo stop contra un indice que se
	///   multiplico por 5. Para operar HACIA ADELANTE manda el calibre ancho.
	///   BACKLOG (no aplicar sin re-validar): reparametrizar el stop en % del precio o en ATR.
	///   Es la 3a vez que un parametro en dolares absolutos muerde en el portafolio
	///   (kill-switch del Momentum, stop del Weekend, este).
	///
	/// OPTIMIZACION - QUE SE PROBO Y QUE NO CAMBIO:
	///   - Hora de entrada: meseta 18:00-22:00 confirmada en el IS; el WFO la roto sin patron
	///     (22:00/20:00/20:00/21:00) = parametro insensible. SE MANTIENE 21:00.
	///   - EMA de tendencia: meseta 50-250 (todo positivo). SE MANTIENE 100 (mejor net).
	///   - Hora de salida: meseta 14:00-16:00; se degrada al mediodia (el edge se acumula
	///     hasta el cierre del lunes). 15:00 y 15:45 son equivalentes dentro de la meseta.
	///   - Stop: respuesta NO MONOTONA en IS y en OOS (1500 bien, 2000 mal, 4000 bien) ->
	///     los numeros finos son ruido; lo estructural es "stop ancho > stop apretado".
	///   - Candidato del IS (stop 2000 / salida 15:00): RECHAZADO en OOS virgen (PF 1.48,
	///     DD -$19.1k, N/DD 1.87). Cuarta vez que el candidato del IS muere en el OOS.
	///   - WFO: 3/4 ventanas positivas, encadenado +$8,957 PF 1.81, pero 2-6 trades por
	///     ventana -> ORIENTATIVO, no concluyente. La decision la tomo el OOS virgen.
	///
	/// CONCENTRACION (config adoptada, 442 trades): top-1 = 5.9% del net, top-10 = 47.6%.
	///   10/12 anios positivos. Unico anio malo: 2018 (-$4.9k). El filtro EMA100 hizo su
	///   trabajo en 2022 (solo 9 trades: se salto el bear) y aun asi cerro +$9.8k.
	///   El edge esta MAS FUERTE que nunca: avg $458/trade en jul24-jul26 vs $265 historico.
	///
	/// Registro: Optimizaciones/WFO_Bot_NQ_WeekendEffect_1min_ETH.xlsx + Tesis (docx).
	/// =====================================================================================
	/// </summary>
	public class PROD_Bot_NQ_WeekendEffect_1min_ETH : Strategy
	{
		private EMA				emaDaily;			// filtro de tendencia (velas diarias)
		private int				entradasEstaSesion;	// contador para el tope
		private DateTime		sesionActual;		// domingo en curso
		private bool			ventanaMarcada;		// ya se dibujo la linea de la ventana

		// Tope de entradas por domingo. NO es arbitrario: el desglose por orden de
		// entrada sobre 2015-2026 mostro que la 2a entrada es la MEJOR del bot
		// (media $86.57 contra $42.88 de la 1a), pero la 3a perdio las 4 veces que
		// ocurrio, siempre en stop (media -$152.90, 0% de aciertos).
		// Tiene sentido: dos stops seguidos son 150 puntos de caida, o sea movimiento
		// direccional, no ruido — y el filtro EMA usa el cierre del viernes, que a
		// esas alturas ya esta desfasado.
		// COSTE: -$142 en 11 años (se renuncia tambien a una 4a entrada afortunada
		// de +$643 que ocurrio una sola vez). Se acepta por RIESGO, no por retorno:
		// acota el peor domingo de -$458.70 a -$305.80 (cifras MNQ con el stop antiguo).
		private const int MaxEntradasPorSesion = 2;

		protected override void OnStateChange()
		{
			if (State == State.SetDefaults)
			{
				Description									= @"Weekend effect NQ/MNQ - 1 MIN CON TEMPLATE ETH (no RTH). Compra el domingo a las 21:00 y cierra el lunes a las 15:00, solo si el cierre diario esta sobre la EMA100 diaria. Re-entrada inmediata si salta el stop, con tope de 2 entradas por domingo. CAMBIO 11-ago-2026: el stop pasa de DOLARES ABSOLUTOS a PORCENTAJE DEL PRECIO (0,87%). Motivo medido: con $4.000 fijos en NQ el stop era el 2,31% del indice en 2015-2017 y el 0,84% en 2024-2026, y la frecuencia con que saltaba paso del 0,0% al 20,2% sin tocar un parametro. La estrategia se estaba deformando sola. El 0,87% reproduce el comportamiento actual y ademas vale igual para NQ que para MNQ. Baseline con el stop absoluto (NQ 2015-2026, comision + slippage 2): net $132.233, PF 1,43, DD -$22.991, Net/DD 5,75, Probability 0,50%, R2 0,84, 443 trades, 59,8% aciertos, t-stat 2,65. OJO REGIMEN: 2015-jun2020 da t 0,61; jul2020-hoy da t 2,61. Cuarto bot de la cartera con el mismo corte post-pandemia. DESCARTADOS: Stop y Take Profit en USD del grupo 9 (el de usuario sobrescribia el stop validado de $4.000 por uno de $50). PENDIENTE: re-validar con el stop en % antes de darlo por bueno.";
				Name										= "PROD_Bot_NQ_WeekendEffect_1min_ETH";
				Calculate									= Calculate.OnBarClose;
				EntriesPerDirection							= 1;
				EntryHandling								= EntryHandling.AllEntries;
				IsExitOnSessionCloseStrategy				= false;	// CRITICO: mantiene la posicion domingo -> lunes
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

				// Horarios en hora del GRAFICO (HHmmss). El grid 2015-2026 mostro una
				// meseta entre 18:10 y 22:00 para la entrada; 21:00 evita la liquidez
				// fina de la reapertura. La salida tiene meseta 14:00-16:00 (el edge se
				// acumula hasta el cierre del lunes y se degrada si sales al mediodia);
				// 15:00 es el centro de esa meseta y evita el ruido del MOC.
				EntryTime		= 210000;
				ExitTime		= 150000;

				Contracts		= 1;

				// Riesgo configurable por el usuario: OFF = comportamiento validado

				// Filtro de tendencia: sin el, la estrategia compra el fin de semana
				// tambien en bear markets, que es justo donde el efecto se da vuelta.
				// Meseta estable entre EMA 100 y 200; se usa 100.
				TrendEMAPeriod	= 100;

				// Stop en DOLARES ABSOLUTOS: NO escala micro <-> mini NI con el nivel del indice.
				// $400 en MNQ = 200 puntos. En NQ mini son 20 puntos -> usar 4000.
				// Valor adoptado 26-jul-2026 tras el pipeline completo: el calibre anterior
				// ($150 MNQ / 75 pts) era el correcto para el NQ de 2015 y hoy asfixia al
				// sistema. Ver el bloque v-2026-07-26 de la cabecera antes de cambiarlo.
				// STOP EN % DEL PRECIO (11-ago-2026). Sustituye al stop en dolares absolutos.
				// 0,87% reproduce EXACTAMENTE el comportamiento actual: con el NQ en ~23.000 son
				// 200 puntos, que es lo que valian los $4.000 de NQ / $400 de MNQ. No es una
				// reoptimizacion: es el mismo stop, expresado de forma que no se deforme sola.
				StopLossPct		= 0.87;

				// ---------- Visualizacion ----------
				// La EMA100 va como PLOT PROPIO, no con AddChartIndicator. Motivo:
				// AddChartIndicator dibuja sobre la serie PRIMARIA del chart, y esta
				// EMA esta calculada sobre Closes[1] (la serie diaria que se añade en
				// Configure). En un chart de 1 minuto el mapeo de barras no coincide y
				// el indicador simplemente no aparece — en uno diario si, porque ahi
				// ambas series son la misma. Copiando el valor a un plot propio se
				// dibuja correctamente en cualquier temporalidad, como escalera.
				AddPlot(Brushes.DodgerBlue, "EMA 100 diaria");	// Values[0] - el filtro
				AddPlot(Brushes.Crimson, "Nivel de stop");		// Values[1] - stop activo

				// Las flechas de entrada/salida las dibuja NinjaTrader: en el chart,
				// click derecho > Strategies > Plot executions = "Text and Marker".
			}
			else if (State == State.Configure)
			{
				AddDataSeries(BarsPeriodType.Day, 1);	// serie diaria para el filtro
			}
			else if (State == State.DataLoaded)
			{
				emaDaily = EMA(Closes[1], TrendEMAPeriod);

				entradasEstaSesion	= 0;
				sesionActual		= DateTime.MinValue;
				ventanaMarcada		= false;
			}
		}

		protected override void OnBarUpdate()
		{
			if (BarsInProgress != 0)			// solo la serie de 1 min
				return;

			if (CurrentBar < BarsRequiredToTrade)
				return;

			DayOfWeek day	= Times[0][0].DayOfWeek;
			int t			= ToTime(Times[0][0]);

			// La ventana de entrada va del domingo a EntryTime hasta medianoche: pasada
			// esa hora ya es lunes y la condicion day == Sunday deja de cumplirse.
			bool enVentanaEntrada = (day == DayOfWeek.Sunday && t >= EntryTime);

			// Al empezar un domingo nuevo se reinicia el contador de entradas.
			if (day == DayOfWeek.Sunday && Times[0][0].Date != sesionActual)
			{
				sesionActual		= Times[0][0].Date;
				entradasEstaSesion	= 0;
				ventanaMarcada		= false;
			}

			// Linea vertical naranja al abrirse la ventana de entrada del domingo.
			// Una sola marca por sesion: basta para ver de un vistazo si las entradas
			// caen donde deben, sin ensuciar el grafico.
			if (enVentanaEntrada && !ventanaMarcada)
			{
				// Sobrecarga simple a proposito: las variantes con DashStyleHelper o
				// Stroke viven en NinjaTrader.Gui, que este archivo no importa.
				Draw.VerticalLine(this, "vent" + Times[0][0].Ticks, 0, Brushes.Orange);
				ventanaMarcada = true;

				// Diagnostico en vivo: deja en el Output Window por que entra o no.
				// El caso mas comun de "no hizo nada" es que el chart tenga pocos
				// dias cargados y la serie diaria no alcance las 100 barras que pide
				// la EMA. En el Analyzer nunca pasa; en un chart en vivo, siempre.
				if (State == State.Realtime)
				{
					bool hayDatos = CurrentBars[1] >= TrendEMAPeriod;
					Print(string.Format(
						"{0} | Ventana abierta | barras diarias {1}/{2} | cierre diario {3} vs EMA {4} => {5}",
						Time[0], CurrentBars[1], TrendEMAPeriod,
						hayDatos ? Closes[1][0].ToString("F2") : "-",
						hayDatos ? emaDaily[0].ToString("F2") : "SIN DATOS SUFICIENTES",
						!hayDatos ? "NO OPERA (sube Days to load a 250)"
								  : (Closes[1][0] > emaDaily[0] ? "COMPRA" : "no opera: por debajo de la EMA")));
				}
			}

			// EMA100 diaria: se copia a un plot propio para que se vea en el chart de
			// 1 minuto. Se dibuja como escalera porque solo cambia una vez al dia.
			// Es EL filtro: si el precio esta por debajo de esta linea, no hay entrada.
			if (CurrentBars[1] >= TrendEMAPeriod)
				Values[0][0] = emaDaily[0];

			// Nivel real del stop mientras hay posicion. Al ser un porcentaje del precio, la
			// linea es correcta en cualquier instrumento y a cualquier nivel del indice.
			if (Position.MarketPosition == MarketPosition.Long)
			{
				double puntos = Position.AveragePrice * (StopLossPct / 100.0);
				Values[1][0] = Position.AveragePrice - puntos;
			}

			if (Position.MarketPosition == MarketPosition.Flat)
			{
				// ENTRADA: domingo desde EntryTime, maximo 2 por sesion. Si el stop saco
				// la posicion, se vuelve a entrar DE INMEDIATO (esperar minutos solo
				// resta: 1min $12,891 > 10min $12,714 > 30min $12,606).
				// Historico 2015-2026: 94% de los domingos con 1 sola entrada,
				// 4.5% con 2. El tope corta la 3a, que perdio 4 de 4.
				if (enVentanaEntrada && entradasEstaSesion < MaxEntradasPorSesion)
				{
					bool uptrend = CurrentBars[1] >= TrendEMAPeriod && Closes[1][0] > emaDaily[0];

					if (uptrend)
					{
						// Stop en PORCENTAJE del precio de entrada: invariante al nivel del indice y al
						// instrumento. El mismo numero vale para NQ y para MNQ, y sigue significando lo
						// mismo con el Nasdaq en 4.300 que en 40.000.
						int stopTicks = (int)Math.Round(Close[0] * (StopLossPct / 100.0) / TickSize);
						if (stopTicks > 0)
							SetStopLoss(CalculationMode.Ticks, stopTicks);
				EnterLong(Contracts, "WeekLong");
						entradasEstaSesion++;
					}
				}
			}
			else
			{
				// SALIDA: lunes a ExitTime. La condicion tambien cierra por seguridad
				// si por cualquier motivo la posicion sobrevivio mas alla de ese punto.
				bool seMantiene = (day == DayOfWeek.Sunday)
								|| (day == DayOfWeek.Monday && t < ExitTime);
				if (!seMantiene)
					ExitLong("WeekExit", "WeekLong");
			}
		}

		#region Properties

		[NinjaScriptProperty]
		[Range(1, int.MaxValue)]
		[Display(Name = "Contratos", Description = "Numero de contratos (MNQ)", Order = 1, GroupName = "1. General")]
		public int Contracts { get; set; }

		[NinjaScriptProperty]
		[Range(0, 235959)]
		[Display(Name = "Hora de entrada (HHmmss)", Description = "Domingo, hora del grafico. Meseta validada 18:10-22:00", Order = 2, GroupName = "1. General")]
		public int EntryTime { get; set; }

		[NinjaScriptProperty]
		[Range(0, 235959)]
		[Display(Name = "Hora de salida (HHmmss)", Description = "Lunes, hora del grafico. 15:45 evita el ruido del cierre", Order = 3, GroupName = "1. General")]
		public int ExitTime { get; set; }

		[NinjaScriptProperty]
		[Range(2, int.MaxValue)]
		[Display(Name = "EMA de tendencia (diaria)", Description = "Solo compra si el cierre diario esta por encima. Meseta 100-200", Order = 1, GroupName = "2. Riesgo")]
		public int TrendEMAPeriod { get; set; }

		[NinjaScriptProperty]
		[Range(0.05, 20.0)]
		[Display(Name = "Stop Loss (% del precio)", Description = "Stop como porcentaje del precio de entrada. Invariante al instrumento y al nivel del indice: 0,87 significa lo mismo en NQ que en MNQ, hoy y dentro de diez anios.", GroupName = "2. Riesgo", Order = 1)]
		public double StopLossPct { get; set; }

		#endregion
	}
}
