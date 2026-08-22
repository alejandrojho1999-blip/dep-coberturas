#region Using declarations
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Windows.Media;			// Brushes, para los AddPlot del filtro de tendencia
using NinjaTrader.Cbi;
using NinjaTrader.NinjaScript;
using NinjaTrader.Data;
#endregion

// Bot_NQ_OvernightDrift_1min v5 - Overnight drift del Nasdaq (NQ/MNQ) con filtro de regimen.
// (Renombrado 17-jul-2026, antes Bot01_NQ_Overnight_Drift. GRAFICO DE 1 MINUTO.)
//
// VERIFICADO EN STRATEGY ANALYZER (17-jul-2026, NQ 09-26 1-min RTH 2015-2026, slippage
// 1 tick + comision): 1,979 trades | net +$291k | PF 1.24 | maxDD -$32k | 56.1% win |
// R2 0.88. Cuadra con el backtest Python (2,167 trades, PF 1.29, +$359k, DD -$51k):
// la diferencia es el warmup de 200 sesiones y la friccion. Sin filtro SMA: +$316k pero
// DD -$68k y PF 1.18 -> el filtro se queda (Net/DD 9.1 vs 4.7).
//
// HIPOTESIS: la mayor parte del retorno del indice se genera del cierre a la apertura.
//  El filtro de tendencia (precio > SMA de 200 cierres de sesion) apaga el bot en
//  bear markets, donde el drift nocturno se vuelve toxico.
//
// VALIDADO EN PYTHON (backtest/backtest_overnight.py, data NQ 2015-2026, 16-jul-2026):
//  Default (SMA200, sin momentum): IS PF 1.18 (+$97.5k) | OOS PF 1.37 (+$262k)
//  Total: +$359k | PF 1.29 | Sharpe 1.22 | maxDD -$51k | 2,167 trades | 57.5% win
//
// POR QUE v5 (17-jul-2026): v1-v3 (SessionIterator) daban 770-1,045 trades de ~2,600
//  posibles; v4 (horarios HHmmss fijos) dio CERO: el reloj del chart no coincide con
//  el ET asumido. v5 elimina TODA dependencia del reloj y de SessionIterator:
//   - Nueva sesion = barra cuyo gap con la anterior supera GapSesionMin minutos
//     (con template RTH el gap nocturno es ~17h; el intradia nunca supera ~15 min).
//   - Hora de cierre = APRENDIDA: el maximo de la hora de la ultima barra de las
//     ultimas 5 sesiones. La ventana de entrada se calcula contra ese cierre.
//   - Robusto a timezone, DST, medios dias (no entra si no hay barras en la ventana).
//
// REQUISITOS CRITICOS:
//  1. Trading Hours = CME US Index Futures RTH (la deteccion por gap REQUIERE que la
//     data solo tenga barras de la sesion diurna).
//  2. IsExitOnSessionCloseStrategy = false (ya esta abajo).
//  3. Barras de 1 minuto.
//
// CONTROL DE RIESGO: no hay stop contra el gap nocturno; el control es el TAMANO.
//  Empieza con 1 MNQ y dimensiona para sobrevivir un gap tipo COVID.
//
// ============================================================================================
// v6 (26-jul-2026) - PIPELINE COMPLETO: *** APROBADO CON CONDICIONES (GO) ***
// Fases 1a/1b + intento de WFO + OOS virgen + concentracion. NQ 1-min RTH, slippage 2.
//
// PARAMETROS: SIN CAMBIO. Todos los defaults confirmados.
//  - Fase 1a (IS ene2021-jun2024, 20 combos): SMA 200 domina el top-5 (PF 1.21-1.23, net
//    $56-61k) contra 100/150/250 (PF 1.10-1.14). "Minutos antes del cierre" INERTE (2-10
//    dan el mismo resultado) -> se queda en 2.
//  - Fase 1b (grid fino 175/200/225 x momentum x tendencia):
//      Momentum OFF + Tendencia ON + SMA 200: net $57.6k | PF 1.21 | DD -$33.1k | N/DD 1.74 <-- MEJOR
//      Momentum ON  + Tendencia ON + SMA 200: net $33.7k | PF 1.24 | DD -$26.1k | N/DD 1.29
//      Momentum OFF + Tendencia OFF        : net $62.7k | PF 1.09 | DD -$65.9k | N/DD 0.95
//      Momentum ON  + Tendencia OFF        : net  $1.2k | PF 1.00 | DD -$79.9k | catastrofico
//    => El filtro de TENDENCIA es imprescindible (duplica el DD sin el). El de MOMENTUM
//       confirmado OFF (sube PF pero corta la mitad de los trades y el net cae 42%).
//  - AVISO HONESTO: la SMA 200 es un PICO, no una meseta (175 y 225 son 20-40% peores en net).
//    En un IS con UN SOLO bear market (2022) eso es probablemente suerte de calendario: la SMA
//    solo decide cuando apagarse/reencender, asi que su muestra efectiva es n=1. Se mantiene
//    200 por convencion (no salio de una optimizacion), NO porque el pico sea evidencia.
//
// *** EL WFO NO ES APLICABLE A ESTE BOT (limitacion estructural) ***
//  Ventanas de test de 183 dias = ~126 sesiones, pero la SMA necesita 200 sesiones completas.
//  NT8 no arrastra el warmup del IS al periodo de test -> las 4 ventanas OOS dieron CERO
//  trades. Para que operara, el test period tendria que superar ~285 dias naturales, lo que
//  con 3.5 anios de IS deja 1 sola ventana (ya no es walk-forward). Sustituido por el split
//  directo IS/OOS + desglose anual.
//
// VALIDACION IS vs OOS (defaults):
//   IS  ene2021-jun2024: PF 1.21 | net $57,612 | DD -$33,059 | 392 trades
//   OOS jul2024-jul2026: PF 1.27 | net $89,316 | DD -$40,074 | 255 trades  <- MEJORA fuera de muestra
//
// FULL SAMPLE 2015-2026: 1,982 trades | net +$252,378 | PF 1.20 | DD -$40,074 | R2 0.87 |
//   55.6% win | avg $127.27 | MTR 805 dias | Probability 0.44% (el mas significativo del portafolio).
//   Avg trade jul24-jul26: $263 vs $94 del historico -> el edge esta MAS FUERTE, no degradado.
//   El filtro trabajo en 2022: solo 16 trades en todo el bear, cerro -$5.4k.
//   9/12 anios positivos. Perdedores: 2016 (-$5.1k), 2018 (-$11.9k), 2022 (-$5.4k).
//   PRE-2019 EL EDGE NO EXISTIA: 2015-2018 suma -$11,832 (mismo patron que el ORB).
//
// CONCENTRACION: top-1 = 5.5% del net (sano), top-10 = 37.2%, top-20 = 64.6%.
//   Sin el top-50 el sistema es negativo: es un sistema de colas, como todo el portafolio.
//
// *** RIESGO DE COLA CRECIENTE - LO MAS IMPORTANTE DE ESTE BOT ***
//   Los 5 PEORES trades de 11.5 anios ocurrieron TODOS en los ultimos 2 anios:
//     jun-2026 -$19,566 | ene-2025 -$14,726 | ago-2024 -$12,891 | jun-2026 -$11,266 | jul-2026 -$10,661
//   No es degradacion: es el mismo gap PORCENTUAL sobre un indice que paso de 4,300 a 23,000.
//   En 2015 el peor trade fue -$1,146; hoy es 17x mayor. Y sin stop, ese numero SEGUIRA creciendo.
//   El peor gap del backtest NO es el peor posible: el desplome de mar-2020 ocurrio con NQ ~9,000;
//   el mismo movimiento hoy costaria 2.5x mas.
//   Distribucion de la cola: 46 trades <= -$5k (suman -$347k) | 13 <= -$8k | 6 <= -$10k.
//
// DECISION (Luis, 26-jul-2026): GO en MNQ con SIZING CONSERVADOR = 1 MNQ por cada $40,000
//   de cuenta. A ese tamano el peor gap historico (-$1,957 MNQ) pesa ~5% y el DD (-$4,007) ~10%,
//   dejando margen para un gap peor que el historico. El riesgo de cola creciente se ACEPTA y
//   se gestiona recalculando el sizing CADA 6 MESES conforme sube el indice.
//   Kill-switch de monitoreo: pausar si el PnL movil de 12 meses cae bajo -1.5x el DD historico.
//
// *** POR QUE ESTE BOT NO LLEVA STOP (evaluado y decidido 26-jul-2026) ***
//   El bot compra al cierre y vende en la apertura siguiente: la posicion vive ENTERA fuera
//   del horario del grafico. Con datos RTH no existen barras entre el cierre y la apertura,
//   asi que un stop NO PUEDE dispararse ahi. En backtest se ejecutaria en la apertura del dia
//   siguiente, igual que la salida normal -> efecto cero, pero por artefacto de datos, no
//   porque el stop sea inutil. EL BACKTEST NO PUEDE RESPONDER ESTA PREGUNTA.
//   Y en real la proteccion seria PARCIAL: una orden stop viva en el mercado saca de una
//   caida nocturna gradual, pero NO protege de un GAP — y los gaps son justo lo que produce
//   las peores operaciones (-$19,566 el 23-jun-2026). Si el mercado abre 3% abajo, el stop
//   se ejecuta al precio de apertura.
//   ALTERNATIVAS EVALUADAS Y DESCARTADAS POR AHORA:
//     (a) Serie secundaria ETH de 1 min para vigilar el stop de noche -> cambio de codigo,
//         obliga a re-correr el pipeline completo, y solo cubre caidas graduales.
//     (b) Limite de dias en posicion (el bot mantiene 1.13 dias de media) -> mismo coste.
//   DECISION (Luis, 26-jul-2026): CONTROL POR TAMANO UNICAMENTE. 1 MNQ por cada $40,000,
//   recalculado cada 6 meses conforme sube el indice. La cola se acepta como el precio del edge.
//   CONTEXTO UTIL: en el RSI2Reversion se probo un stop en dolares (barrido 2000-10000 sobre
//   11.5 anios) y TODAS las variantes empeoraron el drawdown. Un stop no es automaticamente
//   una mejora de riesgo: hay que medirlo.
//
// Registro: Optimizaciones/WFO_Bot_NQ_OvernightDrift_1min_RTH.xlsx + Tesis (docx).
// ============================================================================================

namespace NinjaTrader.NinjaScript.Strategies
{
	public class PROD_Bot_NQ_OvernightDrift_1min_RTH : Strategy
	{
		private List<double>	sessionCloses;		// cierre de cada sesion completada (para SMA)
		private double			smaSum;				// suma movil de los ultimos N cierres
		private List<int>		closeTods;			// hora (min del dia) de la ultima barra de las ultimas sesiones
		private int				learnedCloseTod;	// max de closeTods = hora de cierre aprendida (min del dia)
		private bool			enteredThisSession;	// 1 intento de entrada por sesion

		private static int MinutosDelDia(DateTime t) { return t.Hour * 60 + t.Minute; }

		protected override void OnStateChange()
		{
			if (State == State.SetDefaults)
			{
				Description									= @"Overnight drift NQ/MNQ - compra ~2 min antes del cierre RTH y sale en la apertura siguiente, solo si el cierre esta sobre la SMA de 200 cierres de sesion. CORRER EN 1 MIN CON TEMPLATE RTH: la deteccion de sesion es por gap de barras y con ETH no opera nunca. NQ 2015-2026 con comision y slippage 2: net $244.197, PF 1,19, DD -$41.951, Net/DD 5,82, Probability 0,68%, R2 0,88, 2.076 trades, t-stat 2,49. OJO REGIMEN: 2015-jun2020 da t 0,61 (sin edge); jul2020-hoy da t 2,42. El edge es post-pandemia. SIN STOP, y no por omision: se probo un stop nocturno real con serie ETH secundaria y CUANTO MAS APRETADO, PEOR EN TODO (Net/DD 5,82 sin stop contra 5,31 / 4,98 / 4,05 / 4,02). Una de cada seis operaciones cortadas habria acabado ganando: el movimiento nocturno revierte. DESCARTADOS con datos: Take Profit en USD (costaba $155.580), stop nocturno, filtro de dia bajista (t 0,63) y filtro de momentum overnight. La peor noche fue -$19.931 en NQ (-$1.993 en MNQ) y el riesgo de hueco NO esta acotado: el unico control es el TAMANO, 1 MNQ por cada $40.000 de cuenta.";
				Name										= "PROD_Bot_NQ_OvernightDrift_1min_RTH";
				Calculate									= Calculate.OnBarClose;
				EntriesPerDirection							= 1;
				EntryHandling								= EntryHandling.AllEntries;
				IsExitOnSessionCloseStrategy				= false; // CLAVE: permite mantener overnight
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

				GapSessionMin			= 120;		// gap (min) entre barras que marca sesion nueva
				EntryMinutesBeforeClose	= 2;		// entra ~2 min antes del cierre aprendido
				UseTrendFilter			= true;		// validado: recorta DD a la mitad
				TrendSmaPeriod			= 200;		// meseta 100-250 toda positiva; 200 estandar
				VerboseLog				= false;	// ON solo para depurar (ralentiza el Analyzer)

				Contracts				= 1;		// antes usaba DefaultQuantity

				// LIMPIEZA 11-ago-2026. Eliminados por probados y descartados CON DATOS, no por opinion:
				//   · Take Profit en USD -> costaba $155.580 sobre NQ 2015-2026 (net $88.617 con el, 
				//     $244.197 sin el). Recortaba a los ganadores grandes y dejaba intactos a los
				//     perdedores, justo en un sistema cuyas colas casi se cancelan (-$308k / +$300k).
				//   · Stop Loss en USD -> se aplicaba sobre barras RTH, o sea solo en la apertura.
				//     Sustituido por el stop nocturno del grupo 8, que si ve la madrugada.
				//   · Filtro de dia bajista -> conservadas $153,74/op vs descartadas $90,80/op, t 0,63:
				//     no significativo. Y las descartadas seguian ganando $108.140. Net/DD 5,82 -> 4,77.
				//   · Filtro de momentum overnight -> ya estaba documentado como restador de neto.
				//   · STOP NOCTURNO -> probado a fondo el 11-ago-2026 con una serie ETH secundaria de
				//     1 min que SI veia el recorrido de madrugada, no solo el hueco de apertura.
				//     NQ 2015-2026, 2.076 operaciones en las cuatro corridas. Resultado MONOTONO:
				//        sin stop  -> net $244.197 | PF 1,19 | DD -$41.951 | Net/DD 5,82
				//        stop 6000 -> net $242.057 | PF 1,19 | DD -$45.624 | Net/DD 5,31
				//        stop 4500 -> net $223.632 | PF 1,18 | DD -$44.875 | Net/DD 4,98
				//        stop 3000 -> net $211.662 | PF 1,17 | DD -$52.274 | Net/DD 4,05
				//        stop 1500 -> net $190.092 | PF 1,16 | DD -$47.310 | Net/DD 4,02
				//     Cuanto mas apretado, PEOR EN TODO; el mejor del barrido es el que casi nunca se
				//     activa. MOTIVO: de las operaciones que el stop cortaba, UNA DE CADA SEIS habria
				//     acabado ganando. El movimiento nocturno del Nasdaq revierte con frecuencia y
				//     cortar convierte una excursion temporal en perdida realizada. Coherente con que
				//     las colas casi se cancelen (40 peores noches -$308k / 43 mejores +$300k): no hay
				//     una cola izquierda anomala que recortar, hay varianza, y EL EDGE ES COBRARLA.
				//     AVISO METODOLOGICO: una prueba corta sobre 2024-2026 (384 ops) decia lo CONTRARIO
				//     (+$23.705 con stop 2000). Dos anios apuntaban en una direccion y once en la otra.
				//     El codigo de la serie ETH se elimino tras la prueba. NO REABRIR sin evidencia nueva.
				//     El unico control de riesgo que funciona aqui es el TAMANO: 1 MNQ por $40.000.
				
				// Visualizacion. El filtro de tendencia de este bot no es un indicador
				// nativo: es una SMA sobre CIERRES DE SESION calculada a mano, asi que
				// va por AddPlot. Se vera como escalera (un escalon por sesion).
				AddPlot(Brushes.MediumPurple, "SMA cierres de sesion");
				AddPlot(Brushes.Orange, "Ventana de entrada");
			}
			else if (State == State.DataLoaded)
			{
				sessionCloses		= new List<double>();
				smaSum				= 0;
				closeTods			= new List<int>();
				learnedCloseTod		= -1;
				enteredThisSession	= false;
			}
		}

		protected override void OnBarUpdate()
		{
			if (CurrentBar < BarsRequiredToTrade)
				return;

			double gapMin = (Time[0] - Time[1]).TotalMinutes;

			// -------- DIAGNOSTICO (VerboseLog ON): que barras y gaps ve el bot --------
			if (VerboseLog && CurrentBar <= BarsRequiredToTrade + 30)
				Print(string.Format("DIAG bar {0} | {1} | gap {2:F0} min | O {3} C {4}",
					CurrentBar, Time[0], gapMin, Open[0], Close[0]));
			if (VerboseLog && gapMin >= 30)
				Print(string.Format("DIAG GAP {0:F0} min | {1} -> {2}", gapMin, Time[1], Time[0]));

			// ============ PRIMERA BARRA DE UNA SESION NUEVA (gap nocturno) ============
			if (gapMin >= GapSessionMin)
			{
				// 1) registrar el cierre de la sesion que termino (Close[1], ya completada)
				sessionCloses.Add(Close[1]);
				smaSum += Close[1];
				if (sessionCloses.Count > TrendSmaPeriod)
					smaSum -= sessionCloses[sessionCloses.Count - TrendSmaPeriod - 1];

				// 2) aprender la hora de cierre: ultima barra de las ultimas 5 sesiones
				closeTods.Add(MinutosDelDia(Time[1]));
				if (closeTods.Count > 5)
					closeTods.RemoveAt(0);
				learnedCloseTod = -1;
				foreach (int ct in closeTods)
					if (ct > learnedCloseTod) learnedCloseTod = ct;

				// 3) overnight de anoche (para el filtro momentum)

				// 4) salir del overnight
				if (Position.MarketPosition == MarketPosition.Long)
				{
					double entryP = Position.AveragePrice;
					ExitLong("SalidaApertura", "EntradaCierre");
					if (VerboseLog)
						Print(string.Format("{0} | SALIDA apertura @ {1} | entrada @ {2} | overnight: {3:F2} pts",
							Time[0], Open[0], entryP, Open[0] - entryP));
				}

				enteredThisSession = false;
				return;
			}

			if (learnedCloseTod < 0)
				return; // aun no vimos ninguna sesion completa

			int tod = MinutosDelDia(Time[0]);

			// ---------- Visualizacion ----------
			// La SMA de CIERRES DE SESION es el filtro que decide si se entra: solo
			// compra si Close[0] esta por encima. Se dibuja como escalera porque solo
			// se actualiza una vez por sesion, no barra a barra. Eso es correcto:
			// refleja exactamente lo que mira la estrategia al momento de decidir.
			if (UseTrendFilter && sessionCloses.Count >= TrendSmaPeriod)
				Values[0][0] = smaSum / TrendSmaPeriod;

			// Marca la ventana de entrada (los minutos previos al cierre aprendido).
			// Dibujarla al nivel del precio permite ver de un vistazo en que barras
			// el bot tenia permiso para entrar.
			if (tod >= learnedCloseTod - EntryMinutesBeforeClose && tod < learnedCloseTod - 1)
				Values[1][0] = Close[0];

			// ============ SAFETY: largos en plena sesion diurna (fill deslizado o
			// apertura perdida). No es el trade del bot: cerrar ya. ============
			bool enSesionDia = tod < learnedCloseTod - EntryMinutesBeforeClose - 1;
			if (enSesionDia && Position.MarketPosition == MarketPosition.Long)
			{
				ExitLong("SalidaSafety", "EntradaCierre");
				if (VerboseLog)
					Print(string.Format("{0} | SALIDA SAFETY (posicion diurna) @ {1}", Time[0], Close[0]));
				return;
			}

			// ============ ENTRADA: barra que cierra dentro de [cierre - m, cierre - 1).
			// Se excluye el ultimo minuto: el fill de OnBarClose cae en la barra SIGUIENTE.
			// En medios dias (cierre 13:00) no hay barras en la ventana -> no entra. ============
			bool enVentanaEntrada =
				tod >= learnedCloseTod - EntryMinutesBeforeClose &&
				tod <  learnedCloseTod - 1;

			if (enVentanaEntrada && !enteredThisSession
				&& Position.MarketPosition == MarketPosition.Flat)
			{
				enteredThisSession = true; // 1 intento por sesion (pase no los filtros)

				if (UseTrendFilter)
				{
					if (sessionCloses.Count < TrendSmaPeriod)
						return; // warmup: ~10 meses de sesiones
					double sma = smaSum / TrendSmaPeriod;
					if (Close[0] <= sma)
						return;
				}

				EnterLong(Contracts, "EntradaCierre");
				if (VerboseLog)
					Print(string.Format("{0} | ENTRADA cierre @ {1} | SMA{2}: {3:F2} | cierreTod: {4} | sesiones: {5}",
						Time[0], Close[0], TrendSmaPeriod,
						UseTrendFilter ? smaSum / TrendSmaPeriod : 0,
						learnedCloseTod, sessionCloses.Count));
			}
		}

		#region Inputs

		[NinjaScriptProperty]
		[Range(1, int.MaxValue)]
		[Display(Name = "Contratos", Description = "Numero de contratos por entrada (MNQ recomendado)", GroupName = "Overnight", Order = 6)]
		public int Contracts { get; set; }

		[NinjaScriptProperty]
		[Range(30, 600)]
		[Display(Name = "Gap sesion (min)", Description = "Gap minimo entre barras para marcar sesion nueva. RTH: el gap nocturno es ~17h; 120 es seguro.", GroupName = "Overnight", Order = 0)]
		public int GapSessionMin { get; set; }

		[NinjaScriptProperty]
		[Range(2, 30)]
		[Display(Name = "Minutos antes del cierre", GroupName = "Overnight", Order = 1)]
		public int EntryMinutesBeforeClose { get; set; }

		[NinjaScriptProperty]
		[Display(Name = "Filtro tendencia (SMA cierres de sesion)", GroupName = "Overnight", Order = 3)]
		public bool UseTrendFilter { get; set; }

		[NinjaScriptProperty]
		[Range(1, int.MaxValue)]
		[Display(Name = "SMA tendencia (sesiones)", GroupName = "Overnight", Order = 4)]
		public int TrendSmaPeriod { get; set; }

		[NinjaScriptProperty]
		[Display(Name = "Log detallado (Output)", GroupName = "Overnight", Order = 5)]
		public bool VerboseLog { get; set; }
		#endregion
	}
}
