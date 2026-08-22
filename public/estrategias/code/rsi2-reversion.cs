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
	/// <summary>
	/// Bot_NQ_RSI2Reversion - Mean-reversion swing (Connors) sobre NQ. GRAFICO DIARIO.
	/// (Antes Bot_ES_NQ_RSI2Reversion / Bot8. La version ES se RETIRO el 18-jul-2026: ver abajo.)
	/// Compra pullbacks (RSI(3)&lt;25) sobre la SMA200; sale al cierre sobre la SMA3. Sin stop.
	/// OPERAR EN MICROS: MNQ, un solo chart diario.
	///
	/// POR QUE SE RETIRO LA VERSION ES:
	///  La misma config corriendo en ES y en NQ daba correlacion de PnL diario de 0.50,
	///  pero +0.81 EN EL 10% DE PEORES DIAS. En panico ES y NQ son el mismo activo, asi que
	///  no diversificaban: duplicaban el drawdown justo cuando mas duele. Ademas la version
	///  ES era peor en todo ($546/año y N/DD 3.17, contra $1,651 y N/DD 9.39 en NQ).
	///  Es el mismo edge; se opera una sola vez, en el instrumento donde rinde mas.
	///
	/// VALIDACION NQ 2015-2026 (grid Python back-adjusted + Analyzer):
	///  Python PF 2.0/2.0, $152k | Analyzer PF 2.63, $192k, 131 trades, DD -$20.2k
	///  En micros (MNQ): $1,651/año, DD -$2,025, N/DD 9.39, Sharpe 1.11.
	/// Stop: DOBLEMENTE descartado (grid + Analyzer: cuesta mas net del DD que ahorra).
	/// Cortos: solo rentables en umbrales extremos y concentrados en 2021-22 -> NO produccion.
	/// RIESGO: sin stop, peor trade -$15.7k NQ (-$1.6k en MNQ), crash comprado.
	/// PROPOSITO: unico estilo REVERSION del portafolio (compra el miedo, no la fuerza).
	///
	/// =====================================================================================
	/// v-2026-07-26 - PIPELINE COMPLETO: *** APROBADO (GO) ***
	/// Fases 1a/1b + OOS virgen (A/B/C) + concentracion. NQ Daily ETH, slippage 2.
	/// REQUISITO: template CME US Index Futures ETH (en diario define como se forma cada vela).
	///
	/// PARAMETROS: SIN CAMBIO. Defaults confirmados por 6a vez consecutiva en el portafolio.
	///  - Fase 1a (IS ene2021-jun2024, 18 combos): RSI periodo 2 > 3 > 4 en net; umbral con
	///    meseta 20-30. Mejor del IS: periodo 2 / umbral 20 (PF 3.95, N/DD 6.11, 44 trades).
	///    Los umbrales <=15 con periodo 3-4 dan 1-5 trades y PF 99 (= sin perdedores): descartados.
	///  - Fase 1b (40 combos): la SMA de tendencia en 100 parecia MAGICA -> net $136.9k,
	///    PF 11.75, DD -$3,966, N/DD 34.5 (contra $96.4k / 3.95 / -$15,777 del default 200).
	///  - STOP: confirmado PERJUDICIAL por 3a vez. Con SMA200: sin stop $96.4k/DD -$15.8k;
	///    con stop $90.7k/DD -$21.6k. Cuesta net Y empeora el drawdown.
	///
	/// *** VALIDACION OOS jul2024-jul2026 - EL DISEÑO A/B/C QUE SALVO EL BOT ***
	///   A defaults      (200/3/25/3): $75,310 | PF 3.08 | DD -$13,936 | R2 0.89 | N/DD 5.40 | 26 tr
	///   B campeon IS    (100/2/20/6): $82,059 | PF 2.14 | DD -$43,917 | R2 0.60 | N/DD 1.87 | 34 tr
	///                                 PEOR TRADE -$40,401 (!!) - once veces el DD que tenia en el IS
	///   C solo cambia SMA (100/3/25/3): $72,184 | PF 3.12 | DD -$13,936 | R2 0.94 | N/DD 5.18 | 27 tr
	///
	///   La corrida C fue diseñada para AISLAR el efecto de la SMA, y revelo lo importante:
	///   la SMA 100 NO era el problema (C se comporta igual que A). Lo que destruyo a B fue
	///   la SMA DE SALIDA en 6: mantiene las posiciones 5.58 dias contra 3.49 de C y 3.54 de A.
	///   Salir cuando el precio cierra sobre una media de 6 dias en vez de 3 significa aguantar
	///   mucho mas dentro de un desplome. En el IS nunca le toco un crash; en el OOS si, y
	///   costo -$40,401 en UNA operacion.
	///
	/// *** HALLAZGO CENTRAL: sin stop, la SMA DE SALIDA *ES* el parametro de riesgo ***
	///   En A y C el max drawdown (-$13,935.76) COINCIDE EXACTAMENTE con el peor trade: el DD
	///   de esta estrategia no es acumulacion de perdidas, es el unico crash que compro. Y la
	///   velocidad de la salida decide cuanto cuesta ese crash. Ralentizarla de 3 a 6 lo triplico.
	///   NO TOCAR ExitSMAPeriod = 3 sin re-correr el pipeline completo.
	///
	/// FULL SAMPLE 2015-2026 (defaults): 131 trades | +$187,600 | PF 2.49 | DD -$20,407 |
	///   R2 0.89 | 68.7% win | avg $1,432 | MTR 1,040 dias | Probability 0.05% (la MEJOR del
	///   portafolio pese a la muestra corta). Peor trade -$15,720.76 (ene-2022).
	///   8/12 anios positivos. Perdedores: 2016, 2018, 2019, 2022.
	///   *** CORRECCION 12-ago-2026: LA AFIRMACION ANTERIOR ERA ENGANOSA ***
	///   Se decia aqui que 'el edge existia pre-2019' porque 2015-2018 = +$9.520. Es cierto
	///   como cifra, pero midiendo con el MISMO corte que se aplico a los otros cuatro bots
	///   de la cartera, el cuadro es el contrario:
	///        2015 - jun 2020    52 ops    -$2.085   PF 0,95   t -0,11   <-- NEGATIVO
	///        jul 2020 - hoy     79 ops  +$190.380   PF 3,37   t  4,14
	///   Por anio: 2015 +1.327 | 2016 -4.268 | 2017 +16.657 | 2018 -4.197 | 2019 -4.398 |
	///   2020 +703  ->  seis anios para +$5.825 en total. Practicamente plano.
	///   Desde 2021: +$182.469 en cinco anios y medio. El 97% del beneficio.
	///
	///   CONSECUENCIA PARA EL PORTAFOLIO: este bot NO diversifica el riesgo de regimen.
	///   Se pensaba que si, por ser el unico estilo REVERSION frente a cuatro de momentum.
	///   Pero los CINCO bots comparten la misma firma post-2020. Que la estrategia que
	///   compra miedo y las que compran fuerza dependan del mismo cambio sugiere que el
	///   factor comun no es el momentum: es algo del propio mercado posterior a 2020.
	///
	/// CONCENTRACION: top-1 = 7.7% del net, top-10 = 56.5%, top-20 (15% de los trades) = 90.5%.
	///   COLA: 41 perdedores suman -$126,171; solo 7 trades <= -$5k suman -$66,740 (53% del
	///   gross loss). La cola NO escala con el indice (peores trades repartidos 2018/2020/2022/
	///   2025/2026) porque la salida por SMA3 se autorregula: en alta volatilidad corta antes.
	///
	/// RIESGO PRINCIPAL: MTR de 1,040 dias = 2.85 anios bajo el agua, el PEOR del portafolio.
	///   De 2015 a 2020 el bot no hizo practicamente nada y 2021 solo aporto +$63,716 (34% del
	///   total historico). Hay que poder sentarse 3 anios sin resultados.
	///
	/// DECISION (26-jul-2026): GO en MNQ, 1 MNQ por cada $40,000 de cuenta (misma regla que el
	///   OvernightDrift). Peor trade en MNQ -$1,572 (~4% de la cuenta); DD -$2,041 (~5%).
	///   La restriccion real NO es el dinero: es la PACIENCIA. Kill-switch de monitoreo:
	///   pausar si el PnL movil de 12 meses cae bajo -1.5x el DD historico.
	///
	/// *** BARRIDO DE STOP EN USD (26-jul-2026): RECHAZADO POR 4a VEZ, Y DE FORMA DEFINITIVA ***
	///   Motivacion: acotar la cola izquierda (peor trade -$15,720.76 = el DD entero del bot).
	///   Full sample 2015-2026, NQ Daily ETH, slippage 2, stop en dolares (no ATR):
	///     SIN STOP : +$187,600 | PF 2.49 | DD -$20,407 | 131 trades | 68.7% win   <-- MEJOR
	///     stop  2000: -$5,696  | PF 0.93 | DD -$26,160 |  87 trades
	///     stop  4000: -$2,378  | PF 0.97 | DD -$25,128 |  70 trades
	///     stop  6000: +$8,670  | PF 1.11 | DD -$26,340 |  66 trades
	///     stop  8000: +$9,600  | PF 1.12 | DD -$26,437 |  66 trades
	///     stop 10000: +$111,391| PF 1.43 | DD -$42,253 | 144 trades
	///   EL HALLAZGO: el stop no solo cuesta beneficio, FRACASA EN SU PROPIO OBJETIVO.
	///   TODAS las variantes EMPEORAN el drawdown (-$25k a -$42k contra -$20.4k sin stop).
	///   MECANISMO: el stop vende en la debilidad, y en ese momento el precio suele haber
	///   perdido la SMA200 -> el filtro de tendencia bloquea las entradas de la recuperacion
	///   (131 trades caen a 66). Con stop ancho (10000) pasa lo contrario: reentra y convierte
	///   una perdida de -$15.7k en una cadena que suma el doble (144 trades, DD -$42.3k).
	///   CONCLUSION ESTRUCTURAL: en reversion a la media la cola izquierda NO es un defecto,
	///   es el mecanismo. Comprar el miedo implica que las caidas profundas son donde esta el
	///   dinero. La cola de este bot es IRREDUCIBLE por stop: el unico control es el TAMANO.
	///   NO volver a intentarlo sin una idea distinta (p.ej. limite de dias en posicion, que
	///   es otro mecanismo y exigiria cambio de codigo + pipeline completo).
	///
	/// Registro: Optimizaciones/WFO_Bot_NQ_RSI2Reversion_1dia_ETH.xlsx + Tesis (docx).
	/// =====================================================================================
	/// </summary>
	public class PROD_Bot_NQ_RSI2Reversion_1dia_ETH : Strategy
	{
		private SMA	smaTrend;	// filtro de tendencia mayor (200)
		private SMA	smaExit;	// salida (3): rebote completado al cerrar por encima
		private RSI	rsi;		// RSI(3) sin suavizar

		protected override void OnStateChange()
		{
			if (State == State.SetDefaults)
			{
				Description									= @"RSI2 Reversion NQ/MNQ - GRAFICO DIARIO, template CME US Index Futures ETH. Compra pullbacks (RSI(3) < 25) por encima de la SMA200 y sale cuando el cierre supera la SMA3. SIN STOP. Unico estilo REVERSION de la cartera: compra el miedo, no la fuerza. NQ 2015-2026 con comision y slippage 2: net $188.295, PF 2,50, DD -$20.407, Net/DD 9,23, Probability 0,04%, R2 0,89, 131 trades, 68,7% aciertos, t-stat 3,67. LAS MEJORES METRICAS DE LA CARTERA. PERO OJO REGIMEN: 2015-jun2020 da -$2.085 con t -0,11; jul2020-hoy da +$190.380 con t 4,14. Seis anios planos y luego el 97% del beneficio desde 2021. NO diversifica el riesgo de regimen pese a ser reversion. MUESTRA CORTA: solo 131 operaciones, ~11 al anio. El drawdown maximo tiene fondo el 24-feb-2020: compro la caida del COVID. DESCARTADOS: stop en ATR (perjudicial por 3a vez: cuesta net Y empeora el DD), Stop/Take Profit en USD, y EnableShort (era un parametro fantasma que el codigo nunca leia). NO TOCAR ExitSMAPeriod = 3: sin stop, la SMA de salida ES el parametro de riesgo (pasarla a 6 triplico el peor trade a -$40.401 en el OOS).";
				Name										= "PROD_Bot_NQ_RSI2Reversion_1dia_ETH";
				Calculate									= Calculate.OnBarClose;
				EntriesPerDirection							= 1;
				EntryHandling								= EntryHandling.AllEntries;
				// false: es swing, mantiene la posicion varios dias hasta que el rebote se completa
				IsExitOnSessionCloseStrategy				= false;
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

				Contracts		= 1;

				// Riesgo configurable por el usuario: OFF = comportamiento validado

				// El equity tiene sesgo alcista: la reversion solo funciona del lado largo.
				// Cortos: solo en umbrales extremos y por regimen 2021-22 -> default OFF.
				EnableLong		= true;

				// Filtro de tendencia mayor: clave en Connors. Sin el, la reversion compra
				// caidas en bear markets = desastre. Solo compramos sobre la SMA200.
				TrendSMAPeriod	= 200;

				// Reversion: entrar en sobreventa de corto plazo, salir al normalizarse.
				// Grid 2015-2026: RSI(3)<25 + salida SMA3. La config se valido originalmente
				// en ES y NQ a la vez, lo que da confianza de que no esta sobreajustada a NQ.
				RSIPeriod		= 3;
				RSIEntry		= 25.0;		// comprar cuando RSI(3) < 25
				ExitSMAPeriod	= 3;		// salir cuando Close > SMA3 (rebote completado)

				// Stop: DOBLEMENTE descartado (grid + Analyzer). La defensa real es el
				// filtro SMA200 + operar en MICROS (MNQ).
			}
			else if (State == State.Configure)
			{
			}
			else if (State == State.DataLoaded)
			{
				smaTrend	= SMA(TrendSMAPeriod);
				smaExit		= SMA(ExitSMAPeriod);
				rsi			= RSI(RSIPeriod, 1);	// smooth = 1 -> RSI crudo (estilo Connors)

				// Todo lo que la estrategia MIRA queda visible en el chart:
				// SMA200 (filtro de tendencia), SMA3 (salida) y el RSI(3) que dispara.
				AddChartIndicator(smaTrend);
				AddChartIndicator(smaExit);
				AddChartIndicator(rsi);		// panel propio: aqui se ve el cruce de 25
			}
		}

		protected override void OnBarUpdate()
		{
			if (CurrentBar < BarsRequiredToTrade || CurrentBar < TrendSMAPeriod)
				return;

			bool uptrend = Close[0] > smaTrend[0];	// tendencia mayor alcista

			if (Position.MarketPosition == MarketPosition.Flat)
			{
				// ENTRADA: pullback (RSI sobrevendido) dentro de la tendencia alcista
				if (EnableLong && uptrend && rsi[0] < RSIEntry)
				{
					EnterLong(Contracts, "RSI2Long");
				}
			}
			else if (Position.MarketPosition == MarketPosition.Long)
			{
				// SALIDA: rebote completado (el precio recupera y cierra sobre la SMA corta)
				if (Close[0] > smaExit[0])
					ExitLong("RSI2Exit", "RSI2Long");
			}
		}

		#region Properties

		[NinjaScriptProperty]
		[Range(1, int.MaxValue)]
		[Display(Name = "Contracts", Description = "Numero de contratos (micros: MNQ)", Order = 1, GroupName = "1. General")]
		public int Contracts { get; set; }

		[NinjaScriptProperty]
		[Display(Name = "Enable Long", Description = "Comprar pullbacks en tendencia alcista (reversion clasica de Connors)", Order = 2, GroupName = "1. General")]
		public bool EnableLong { get; set; }

		[NinjaScriptProperty]
		[Range(2, int.MaxValue)]
		[Display(Name = "Trend SMA Period", Description = "SMA del filtro de tendencia mayor (solo largos por encima). Connors: 200.", Order = 1, GroupName = "2. Reversion")]
		public int TrendSMAPeriod { get; set; }

		[NinjaScriptProperty]
		[Range(2, int.MaxValue)]
		[Display(Name = "RSI Period", Description = "Periodo del RSI de reversion. Validado: 3.", Order = 2, GroupName = "2. Reversion")]
		public int RSIPeriod { get; set; }

		[NinjaScriptProperty]
		[Range(1.0, 99.0)]
		[Display(Name = "RSI Entry (<)", Description = "Comprar cuando el RSI cae por debajo de este nivel. Validado: 25.", Order = 3, GroupName = "2. Reversion")]
		public double RSIEntry { get; set; }

		[NinjaScriptProperty]
		[Range(2, int.MaxValue)]
		[Display(Name = "Exit SMA Period", Description = "SMA corta de salida: cerrar cuando el precio cierra por encima. Validado: 3.", Order = 4, GroupName = "2. Reversion")]
		public int ExitSMAPeriod { get; set; }

		#endregion
	}
}
