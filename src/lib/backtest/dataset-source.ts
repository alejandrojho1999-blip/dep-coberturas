/**
 * El dataset publicado, cargado desde el JSON versionado.
 *
 * Vive aparte de `dataset.ts` por dos razones. La primera es práctica: los
 * scripts de `scripts/**` corren con Node, que exige atributos de importación
 * para JSON, mientras que el bundler de Next no los admite; separando la carga,
 * las funciones de construcción sirven a los dos. La segunda es de peso: este
 * módulo arrastra medio mega de operaciones y solo debe importarlo la ruta de
 * API, nunca la pantalla, o ese medio mega viajaría al navegador en cada visita.
 * No se marca con `server-only` porque el paquete no está instalado; lo que
 * protege la regla es que ningún componente lo importa, y una prueba lo vigila.
 */
import { catalogoDataset, type DatasetPublicado, type EntradaCatalogo } from './dataset'
import { catalogoOpciones, type DatasetOpciones } from './opciones-dataset'
import datos from './dataset-publicado.json'
import datosOpciones from './opciones-dataset-publicado.json'

export const DATASET_BACKTEST = datos as unknown as DatasetPublicado
export const DATASET_OPCIONES = datosOpciones as unknown as DatasetOpciones

/**
 * Todo lo que la aplicación sabe entregar: acciones y opciones.
 *
 * Los dos catálogos se concatenan y la ruta de API busca por nombre, así que los
 * ficheros de opciones llevan el prefijo `opciones-`: una colisión de nombres
 * serviría el fichero equivocado sin avisar. Hay un test que comprueba que
 * ninguno se repite.
 */
export function catalogoCompleto(): EntradaCatalogo[] {
  return [...catalogoDataset(DATASET_BACKTEST), ...catalogoOpciones(DATASET_OPCIONES)]
}

/** Busca una entrada del catálogo por nombre de fichero. */
export function entradaDataset(fichero: string): EntradaCatalogo | undefined {
  return catalogoCompleto().find(e => e.fichero === fichero)
}
