# ============================================================
# ppo_env.py — Entorno gymnasium para Agente PPO v3
# Estado: 13N + N·L + 1 dims  |  Acción: α_i ∈ [0,1] por activo
# ============================================================
import numpy as np
import gymnasium as gym
from gymnasium import spaces


class EntornoPortafolioOptimizador(gym.Env):
    """
    Estado (N activos, L días de ventana):
    ┌──────────────────────────────────────────────────────┐
    │ Bloque 1 — Posición actual              3N dims      │
    │   w_actual, pesos_obj, delta_w                       │
    ├──────────────────────────────────────────────────────┤
    │ Bloque 2 — Mercado                    N·L+N+1 dims   │
    │   ret_log (N×L), vol (N), momentum (1)               │
    ├──────────────────────────────────────────────────────┤
    │ Bloque 3 — Causal M1.1                  7N dims      │
    │   trat_mean_L, trat_std_L, trat_last,                │
    │   trat_mean_trim, beta_std, score, exposicion_causal │
    ├──────────────────────────────────────────────────────┤
    │ Bloque 4 — Portafolio M1.2               N dims      │
    │   iv_rel (varianza inversa relativa rolling)         │
    ├──────────────────────────────────────────────────────┤
    │ Bloque 5 — Interacción causal×portafolio N dims      │
    │   señal_causal_i × delta_w_i                         │
    └──────────────────────────────────────────────────────┘
    Total: 13N + N·L + 1

    Acción: α_i ∈ [0,1] para cada activo
      w_nuevo_i = w_actual_i + α_i × (w*_i − w_actual_i)
    """
    metadata = {"render_modes": []}

    def __init__(
        self,
        retornos,
        pesos_obj,
        treatment_mat,
        treatment_mat_trim,
        iv_mat,
        beta_std,
        score,
        ventana_L    = 6,
        costo_trans  = 0.001,
        lambda_dd    = 0.1,
        dd_max       = 0.15,
        pen_desv     = 0.3,
        bonus_conv   = 0.2,
        bonus_causal = 5.0,
        escala_causal= 100.0,
        frec_decision= 1,
        bonus_alpha  = 10.0,   # recompensa extra por superar el retorno del portafolio estático w*
    ):
        super().__init__()

        self.retornos  = retornos.values.astype(np.float32)
        self.fechas    = retornos.index
        self.tickers   = retornos.columns.tolist()
        self.N         = retornos.shape[1]
        self.L         = ventana_L
        self.c         = costo_trans
        self.lambda_dd = lambda_dd
        self.dd_max    = dd_max
        self.pen_desv  = pen_desv
        self.bonus_conv    = bonus_conv
        self.bonus_causal  = bonus_causal
        self.escala_causal = escala_causal
        self.bonus_alpha   = bonus_alpha
        self.frec      = frec_decision

        def _align(df):
            return (
                df.reindex(index=retornos.index, columns=retornos.columns)
                .fillna(0.0)
                .values
                .astype(np.float32)
            )

        self.treatments      = _align(treatment_mat)
        self.treatments_trim = _align(treatment_mat_trim)
        self.iv_mat = (
            iv_mat.reindex(index=retornos.index, columns=retornos.columns)
            .fillna(1.0 / retornos.shape[1])
            .values
            .astype(np.float32)
        )
        self.beta_std  = beta_std.astype(np.float32)
        self.score     = score.astype(np.float32)
        self.pesos_obj = pesos_obj.reindex(retornos.columns).fillna(0.0).values.astype(np.float32)
        # Normalizar por si la suma ≠ 1
        if self.pesos_obj.sum() > 0:
            self.pesos_obj /= self.pesos_obj.sum()

        self.dim_estado = 13 * self.N + self.N * self.L + 1

        self.observation_space = spaces.Box(
            low=-np.inf, high=np.inf,
            shape=(self.dim_estado,), dtype=np.float32,
        )
        self.action_space = spaces.Box(
            low=0.0, high=1.0, shape=(self.N,), dtype=np.float32,
        )
        self.t = self.w_actual = self.valor_port = self.peak = None

    # ----------------------------------------------------------
    def _get_obs(self):
        inicio    = max(0, self.t - self.L)
        bloque    = self.retornos[inicio: self.t]
        bloque_tr = self.treatments[inicio: self.t]

        if bloque.shape[0] < self.L:
            pad       = np.zeros((self.L - bloque.shape[0], self.N), np.float32)
            bloque    = np.vstack([pad, bloque])
            bloque_tr = np.vstack([pad, bloque_tr])

        ret_log  = np.log1p(np.clip(bloque, -0.99, None)).flatten()
        vol      = np.nan_to_num(bloque.std(axis=0)).astype(np.float32)
        momentum = np.array([np.log1p(np.clip(bloque, -0.99, None)).sum()], np.float32)

        trat_mean_L    = bloque_tr.mean(axis=0).astype(np.float32)
        trat_std_L     = bloque_tr.std(axis=0).astype(np.float32)
        trat_last      = bloque_tr[-1].astype(np.float32)
        trat_mean_trim = self.treatments_trim[self.t - 1].astype(np.float32)

        iv_rel_act          = self.iv_mat[self.t - 1].astype(np.float32)
        exposicion_causal   = (self.beta_std * self.score * trat_mean_L).astype(np.float32)

        delta_w           = (self.w_actual - self.pesos_obj).astype(np.float32)
        senal_interaccion = (exposicion_causal * delta_w).astype(np.float32)

        return np.concatenate([
            self.w_actual,         # N — Bloque 1
            self.pesos_obj,        # N
            delta_w,               # N
            ret_log,               # N·L — Bloque 2
            vol,                   # N
            momentum,              # 1
            trat_mean_L,           # N — Bloque 3
            trat_std_L,            # N
            trat_last,             # N
            trat_mean_trim,        # N
            self.beta_std,         # N
            self.score,            # N
            exposicion_causal,     # N
            iv_rel_act,            # N — Bloque 4
            senal_interaccion,     # N — Bloque 5
        ]).astype(np.float32)

    # ----------------------------------------------------------
    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        self.t          = self.L
        self.w_actual   = self.np_random.dirichlet(np.ones(self.N)).astype(np.float32)
        self.valor_port = 1.0
        self.peak       = 1.0
        return self._get_obs(), {}

    # ----------------------------------------------------------
    def step(self, accion):
        alpha_vec  = np.clip(accion, 0.0, 1.0).astype(np.float32)
        desv_antes = float(np.abs(self.w_actual - self.pesos_obj).sum())

        w_nuevo = self.w_actual + alpha_vec * (self.pesos_obj - self.w_actual)
        w_nuevo = np.clip(w_nuevo, 0, None)
        w_sum   = w_nuevo.sum()
        if w_sum > 0:
            w_nuevo /= w_sum
        w_nuevo = w_nuevo.astype(np.float32)

        costo_tx    = self.c * np.abs(w_nuevo - self.w_actual).sum()
        t_fin       = min(self.t + self.frec, len(self.retornos) - 1)
        ret_periodo = float(np.prod(1 + self.retornos[self.t:t_fin] @ w_nuevo) - 1)
        ret_estatico = float(np.prod(1 + self.retornos[self.t:t_fin] @ self.pesos_obj) - 1)
        alpha_vs_static = ret_periodo - ret_estatico  # >0 si PPO supera al estático

        t_ini_pasado   = max(0, self.t - self.frec)
        trat_pasado    = self.treatments[t_ini_pasado: self.t].mean(axis=0)
        senal_causal_i = self.beta_std * self.score * trat_pasado

        exposicion_causal = float(np.sum(w_nuevo * senal_causal_i))
        delta_w_paso      = w_nuevo - self.w_actual
        alineacion        = float(
            np.sum(np.sign(senal_causal_i) * delta_w_paso * np.abs(senal_causal_i))
        )

        self.valor_port *= (1 + ret_periodo)
        self.peak        = max(self.peak, self.valor_port)
        dd_actual        = (self.peak - self.valor_port) / self.peak
        pen_dd           = self.lambda_dd * max(0.0, dd_actual - self.dd_max)

        desv_despues       = float(np.abs(w_nuevo - self.pesos_obj).sum())
        penaliz_desv       = self.pen_desv * desv_despues
        bonus_convergencia = self.bonus_conv * (desv_antes - desv_despues)

        reward = float(
            ret_periodo
            - costo_tx
            - pen_dd
            - penaliz_desv
            + bonus_convergencia
            + self.bonus_causal * self.escala_causal * exposicion_causal
            + 2.0 * self.escala_causal * alineacion
            + self.bonus_alpha * alpha_vs_static   # premia superar el portafolio estático w*
        )

        self.w_actual = w_nuevo
        self.t        = t_fin
        terminated    = self.t >= len(self.retornos) - 1

        return self._get_obs(), reward, terminated, False, {
            "retorno"           : ret_periodo,
            "ret_estatico"      : ret_estatico,
            "alpha_vs_static"   : alpha_vs_static,
            "costo_tx"         : float(costo_tx),
            "drawdown"         : float(dd_actual),
            "alpha"            : float(alpha_vec.mean()),
            "alpha_vec"        : alpha_vec.copy(),
            "desviacion"       : float(desv_despues),
            "valor_port"       : float(self.valor_port),
            "pesos"            : w_nuevo.copy(),
            "exposicion_causal": float(exposicion_causal),
            "alineacion_causal": float(alineacion),
        }

    def render(self):
        pass
