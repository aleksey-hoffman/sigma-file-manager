# Registro de cambios

## [2.2.0] - July 2026

**Resumen:** Integración del portapapeles del sistema con otras aplicaciones, selección por marco, vista dividida vinculada, gestión de enlaces, archivos ZIP protegidos con contraseña, propiedades nativas en Windows, ampliación de las API para extensiones, compatibilidad con el hebreo y mejoras en la navegación.

- [Nuevas funciones](#nuevas-funciones)
  - [Integración del portapapeles del sistema](#integración-del-portapapeles-del-sistema)
  - [Selección por marco](#selección-por-marco)
  - [Vista dividida vinculada](#vista-dividida-vinculada)
  - [Gestión de enlaces](#gestión-de-enlaces)
  - [Ventana de propiedades nativa](#ventana-de-propiedades-nativa)
  - [Redimensionar y reordenar columnas de la vista de lista](#redimensionar-y-reordenar-columnas-de-la-vista-de-lista)
  - [Dirección raíz «Ubicaciones»](#dirección-raíz-ubicaciones)
- [Extensiones](#extensiones)
  - [APIs y vistas de extensiones](#apis-y-vistas-de-extensiones)
- [Nuevas configuraciones](#nuevas-configuraciones)
- [Nuevos atajos de teclado](#nuevos-atajos-de-teclado)
- [Nuevos idiomas](#nuevos-idiomas)
- [Mejoras de UX](#mejoras-de-ux)
  - [Extracción de archivos](#extracción-de-archivos)
  - [Ordenación de cuadrícula](#ordenación-de-cuadrícula)
  - [Extensiones de shell](#extensiones-de-shell)
  - [Memoria de sesión](#memoria-de-sesión)
  - [Rendimiento del navegador](#rendimiento-del-navegador)
  - [Página de inicio y menús contextuales](#página-de-inicio-y-menús-contextuales)
- [Mejoras de interfaz](#mejoras-de-interfaz)
- [Corrección de errores](#corrección-de-errores)

### Nuevas funciones

#### Integración del portapapeles del sistema

Copia y pega archivos, carpetas e imágenes entre Sigma File Manager y otras aplicaciones a través del portapapeles del sistema.

- **Transferencia de archivos entre aplicaciones**: copia o corta elementos en SFM y pégalos en aplicaciones como el Explorador de archivos, o pega rutas y archivos copiados desde otras aplicaciones en el navegador con `Ctrl+V`;
- **Pegar imágenes**: pega imágenes copiadas desde navegadores y otras aplicaciones directamente en una carpeta;
- **Resolución de conflictos**: cuando los elementos pegados ya existen, elige `Renombrar` o `Combinar`, y resuelve cada conflicto de archivo con Reemplazar, Omitir, Conservar ambos o Aplicar a todos;
- **Barra de herramientas del portapapeles**: muestra opcionalmente una vista previa de las imágenes y rutas de archivo copiadas en otras aplicaciones;

La visibilidad de la barra de herramientas se puede controlar en `Configuración > Apariencia de la interfaz > Portapapeles`. Pegar con `Ctrl+V` sigue funcionando cuando la barra de herramientas está oculta.

![system-clipboard](./public/changelog/assets/2.2.0/system-clipboard.webp)

#### Selección por marco

Arrastra sobre un espacio vacío del navegador para seleccionar varios elementos con un marco de selección.

- **Modificadores**: mantén `Ctrl` o `Shift` para añadir a la selección actual; mantén `Alt` para invertir;
- **Selección más sencilla**: aumenta de forma opcional el espaciado de las listas y cuadrículas para disponer de más espacio desde el que iniciar el arrastre;

Actívalo en `Configuración > General > Vista de archivos > Activar selección por marco`.

![box-selection](./public/changelog/assets/2.2.0/box-selection.webp)

#### Vista dividida vinculada

El nuevo modo de vista dividida `Vinculada` ofrece un flujo de trabajo por columnas más sencillo: al hacer clic en una carpeta del primer panel, su contenido aparece en el segundo.

El modo independiente `Dividida` no cambia. Elige el modo en la opción `Modo de vista dividida` del menú del navegador, o activa y desactiva la vista dividida con `Ctrl+S`.

También se actualizó el icono del panel de información para distinguirlo más fácilmente del icono de la vista dividida.

![linked-split-view](./public/changelog/assets/2.2.0/linked-split-view.webp)

#### Gestión de enlaces

Crea e inspecciona enlaces del sistema de archivos desde el navegador.

- **Crear enlace**: crea enlaces simbólicos, accesos directos, enlaces duros y uniones desde el menú contextual (`Crear enlace`);
- **Columnas de enlaces**: columnas opcionales en la vista de lista para Tipo, Enlaces, Destino del enlace y Estado del enlace (`Válido`, `Roto`, `Desconocido`, `No admitido`);
- **Comportamiento al abrir**: los accesos directos a directorios y las carpetas enlazadas simbólicamente llevan a sus destinos; los demás destinos se abren con la aplicación predeterminada;

![link-handling](./public/changelog/assets/2.2.0/link-handling.webp)

#### Ventana de propiedades nativa

En Windows, abre el cuadro de diálogo nativo de propiedades del sistema para los elementos seleccionados desde el menú contextual, el menú de acciones, `Alt+Enter` o `Alt` + doble clic.

![native-properties](./public/changelog/assets/2.2.0/native-properties.webp)

#### Redimensionar y reordenar columnas de la vista de lista

Las columnas de la vista de lista se pueden redimensionar y reordenar según tu forma de trabajar.

- **Redimensionar**: arrastra los bordes de las columnas para cambiar el ancho;
- **Orden y visibilidad**: gestiona el orden y la visibilidad desde el menú `Columnas` del encabezado de la lista;
- **Opciones de ancho**: `Rellenar el ancho disponible` y `Establecer anchos mínimos`;

![list-column-resize](./public/changelog/assets/2.2.0/list-column-resize.webp)

#### Dirección raíz «Ubicaciones»

La dirección raíz `Ubicaciones` muestra las unidades y ubicaciones virtuales para que puedas cambiar entre ellas con mayor rapidez.

- **Barra de direcciones**: sube un nivel desde la raíz de una unidad o abre `Ubicaciones` desde la barra o el editor de direcciones;
- **Favoritos y etiquetas**: `Ubicaciones` se puede añadir a favoritos y etiquetar como cualquier otro directorio;
- **Vista dividida**: especialmente útil para cambiar de unidad entre paneles sin salir del navegador;

![root-locations-address](./public/changelog/assets/2.2.0/root-locations-address.webp)

### Extensiones

#### APIs y vistas de extensiones

Las extensiones disponen de más funciones de integración con la aplicación y de nuevos componentes de interfaz.

- **Binarios locales**: configura las dependencias de las extensiones mediante la instalación automática o seleccionando manualmente los binarios locales (`Extensiones > Dependencias`);
- **Solicitudes HTTP**: las extensiones pueden realizar solicitudes HTTP a los servidores permitidos por su manifiesto;
- **Control de la vista**: las extensiones pueden aplicar preferencias de disposición y ordenación en el navegador (con el permiso de vista);
- **API del portapapeles**: las extensiones pueden leer y escribir el portapapeles (con permiso);
- **Vista de lista y detalles**: nuevo patrón de interfaz para extensiones con una lista en la que se puede buscar y un panel de detalles;

![extension-local-binaries](./public/changelog/assets/2.2.0/extension-local-binaries.webp)

![extension-dependency-config](./public/changelog/assets/2.2.0/extension-dependency-config.webp)

![extension-list-detail](./public/changelog/assets/2.2.0/extension-list-detail.webp)

![extension-http-api](./public/changelog/assets/2.2.0/extension-http-api.webp)

### Nuevas configuraciones

- **Activar selección por marco**: arrastra desde un espacio vacío para seleccionar varios elementos;
  `Configuración > General > Vista de archivos > Activar selección por marco`
- **Aumentar espacios de la vista de archivos**: añade más espacio a las listas y cuadrículas para facilitar la selección;
  `Configuración > General > Vista de archivos > Aumentar espacios de la vista de archivos`
- **Mantener la ventana de Vista rápida en memoria**: mantiene la Vista rápida cargada para que se abra al instante (usa unos 200 MB);
  `Configuración > General > Rendimiento > Mantener la ventana de Vista rápida en memoria`
- **Mantener la ventana de Impresión en memoria**: mantiene la ventana de Impresión cargada para que se abra al instante (usa unos 200 MB);
  `Configuración > General > Rendimiento > Mantener la ventana de Impresión en memoria`
- **Barra de herramientas del portapapeles para imágenes externas**: muestra la barra de herramientas del portapapeles para imágenes copiadas en otras aplicaciones;
  `Configuración > Apariencia de la interfaz > Portapapeles`
- **Barra de herramientas del portapapeles para rutas externas**: muestra la barra de herramientas del portapapeles para rutas de archivos copiadas en otras aplicaciones;
  `Configuración > Apariencia de la interfaz > Portapapeles`
- **Tamaño dinámico del panel de información**: adapta automáticamente el tamaño del panel de información; para desactivar esta opción, redimensiónalo manualmente;
  `Configuración > Apariencia de la interfaz > Panel de información > Tamaño dinámico del panel de información`
- **Mostrar imagen a tamaño completo en la vista previa del panel de información**: muestra imágenes a resolución completa en el panel de información;
  `Configuración > Apariencia de la interfaz > Panel de información > Mostrar imagen a tamaño completo en la vista previa del panel de información`
- **Silenciar la vista previa de vídeo de forma predeterminada**: silencia las vistas previas de vídeo del panel de información al explorar;
  `Configuración > Apariencia de la interfaz > Panel de información > Silenciar la vista previa de vídeo de forma predeterminada`
- **Reproducir automáticamente las vistas previas de vídeo**: reproduce automáticamente los vídeos en el panel de información al seleccionarlos;
  `Configuración > Apariencia de la interfaz > Panel de información > Reproducir automáticamente las vistas previas de vídeo`

### Nuevos atajos de teclado

- **Propiedades nativas** (`Alt+Enter`): abre la ventana nativa de Propiedades para los elementos seleccionados en Windows;

### Nuevos idiomas

- **Hebreo** (`עברית`): traducción completa compatible con interfaces de derecha a izquierda (`Configuración > General > Idioma`);

### Mejoras de UX

#### Extracción de archivos

La extracción de archivos ZIP ahora admite archivos ZIP cifrados y nombres de archivo con codificaciones distintas de UTF-8.

- **ZIP protegido con contraseña**: introduce la contraseña del archivo cuando la extracción la requiera;
- **Codificación de nombres de archivo**: elige la codificación en `Opciones de extracción de archivos`; se prioriza la detección automática y se ofrecen grupos de codificaciones regionales como alternativas;

![archive-extraction-options](./public/changelog/assets/2.2.0/archive-extraction-options.webp)

![archive-extraction-encoding](./public/changelog/assets/2.2.0/archive-extraction-encoding.webp)

#### Ordenación de cuadrícula

El diseño de cuadrícula ahora tiene sus propios controles de ordenación en el menú de opciones del navegador.

- **Ordenar por**: Nombre, Elementos, Tamaño, Modificado, Creado, Etiquetas, Tipo, Enlaces y Estado del enlace;
- **Dirección**: ascendente o descendente, guardada por separado de la ordenación de la vista de lista;

![grid-sorting](./public/changelog/assets/2.2.0/grid-sorting.webp)

#### Extensiones de shell

El menú contextual puede cargar en `Extensiones de shell` las acciones modernas del shell registradas por otras aplicaciones.

![shell-extensions](./public/changelog/assets/2.2.0/shell-extensions.webp)

#### Memoria de sesión

Las posiciones de desplazamiento y las pestañas activas se restauran al volver a una página o un panel durante la misma sesión.

#### Rendimiento del navegador

Navegar por carpetas grandes y contenido multimedia ahora es más rápido y consume menos memoria.

- **Carga inicial**: los directorios se muestran más rápido la primera vez que se abren;
- **Carga de iconos**: los iconos personalizados y del sistema aparecen con menos retraso;
- **Desplazamiento por listas**: desplazamiento más fluido en directorios grandes;
- **Vistas previas multimedia**: las vistas previas de imágenes, GIF y vídeo responden mejor y usan menos memoria;
- **Indexación**: indexación de búsqueda global más estable;

#### Página de inicio y menús contextuales

- **Desconectar**: desconecta unidades de red o extraíbles desde el menú contextual cuando el sistema lo permita;
- **Cerrar todos los duplicados**: la opción `Cerrar todos los duplicados` del menú de pestañas ahora cierra todas las rutas duplicadas del espacio de trabajo, no solo las duplicadas de la pestaña actual;
- **Anular la selección con el botón derecho**: al hacer clic con el botón derecho en un área vacía del navegador, se anula la selección antes de abrir el menú contextual del fondo;
- **Acciones de Inicio**: los menús contextuales de la página de inicio se cierran después de elegir una acción, `Abrir en una pestaña nueva` abre el navegador y las pestañas nuevas se desplazan hasta quedar visibles;
- **Área de arrastre de la ventana**: en las barras de título de estilo Linux, el área de arrastre se extiende sobre los botones de la barra de herramientas para facilitar el movimiento de la ventana;

![window-drag-region](./public/changelog/assets/2.2.0/window-drag-region.webp)

### Mejoras de interfaz

- **Indicador de panel activo**: indicador más claro del panel activo en la barra de estado cuando la vista dividida está activada;
- **Panel de información redimensionable**: arrastra para cambiar el ancho del panel de información y la división entre vista previa y detalles;
- **Panel de información compacto**: presentación más compacta de las propiedades en el panel de información;
- **Acciones del menú contextual**: `Editar tarjeta` se muestra como botón de acción, con botones de acción más pequeños en general;
- **Estilos del navegador**: mejoras en el diseño adaptativo, el estado activo de las pestañas en la vista dividida y la vista de extensiones de la paleta de comandos;
- **Diseño RTL**: alineación más limpia para idiomas de derecha a izquierda;

![resizable-info-panel](./public/changelog/assets/2.2.0/resizable-info-panel.webp)

![compact-info-panel](./public/changelog/assets/2.2.0/compact-info-panel.webp)

### Corrección de errores

- **Escribir para buscar**: se corrigió un problema que impedía activar la búsqueda rápida con distribuciones de teclado no latinas;
- **Carga de directorios**: se corrigió la reordenación de las entradas al terminar de cargar un directorio;
- **Iconos personalizados**: se corrigió el retraso perceptible al cargar iconos personalizados;
- **Tarjetas de cuadrícula**: se corrigió el cambio de tamaño de las tarjetas mientras se cargaban;
- **Barra de desplazamiento de cuadrícula**: se corrigió un problema por el que la barra de desplazamiento quedaba oculta tras los encabezados fijos;
- **Selección rápida**: se corrigió un problema por el que la selección rápida a veces abría el archivo;
- **Atajo de terminal**: se corrigió un problema por el que `Alt+T` abría el terminal en el directorio actual en lugar de hacerlo en la entrada seleccionada;
- **Abrir archivos**: se corrigió la apertura de archivos desde un directorio de trabajo incorrecto;
- **Recursos compartidos SMB**: se corrigió un problema que impedía abrir archivos en recursos compartidos SMB;
- **Rutas WSL**: se corrigió la gestión de rutas UNC del host de WSL en Windows, incluida `//wsl.localhost` como lista virtual de distribuciones;
- **Administrador de archivos predeterminado**: se corrigió la configuración del administrador de archivos predeterminado en las versiones de Microsoft Store;
- **AppImage (Linux)**: corregido `Could not create default EGL display: EGL_BAD_PARAMETER`;
- **Instalación de extensiones (Linux)**: se corrigieron los fallos al instalar extensiones distribuidas en varios archivos;
- **Detalles de extensiones**: se corrigió la alineación de la página de resumen;
- **Reactivación del dispositivo**: se corrigió un problema por el que la aplicación quedaba bloqueada en el estado de carga al reactivar el dispositivo;
- **Notificaciones de actualización**: se corrigieron las notificaciones de versiones que aún no se habían publicado;
- **RTL**: se corrigieron varios problemas en el diseño de derecha a izquierda;
- **Traducciones**: se corrigieron cadenas de traducción incorrectas o ausentes;

---

## [2.1.0] - May 2026

**Resumen:** Mejoras de rendimiento del navegador, generación de miniaturas, temas aportados por extensiones, impresión, vistas previas de archivos, nuevos atajos, mejoras en el editor de direcciones, rediseño del centro de estado y perfeccionamiento de las pestañas y la navegación.

- [Nuevas funciones](#nuevas-funciones)
  - [Impresión](#impresión)
  - [Soltar archivos en pestañas](#soltar-archivos-en-pestañas)
  - [Vista previa de archivos en el panel de información](#vista-previa-de-archivos-en-el-panel-de-información)
  - [Columnas de lista del navegador](#columnas-de-lista-del-navegador)
- [Extensiones](#extensiones)
  - [Temas de aplicación desde extensiones](#temas-de-aplicación-desde-extensiones)
  - [Temas de iconos desde extensiones](#temas-de-iconos-desde-extensiones)
- [Nuevas configuraciones](#nuevas-configuraciones)
- [Nuevos atajos de teclado](#nuevos-atajos-de-teclado)
- [Mejoras de UX](#mejoras-de-ux)
  - [Rendimiento en directorios grandes](#rendimiento-en-directorios-grandes)
  - [Búsqueda rápida](#búsqueda-rápida)
  - [Editor de direcciones](#editor-de-direcciones)
  - [Centro de estado](#centro-de-estado)
  - [Navegación y pestañas](#navegación-y-pestañas)
  - [Gestión de atajos](#gestión-de-atajos)
- [Mejoras de interfaz](#mejoras-de-interfaz)
- [Corrección de errores](#corrección-de-errores)

### Nuevas funciones

#### Impresión

Imprime archivos seleccionados directamente desde el navegador usando el menú contextual, el menú de acciones o `Ctrl+O`.

- **Formatos admitidos**: imágenes, PDF, formatos de texto;
- **Salida rápida**: cierra la vista de impresión con `Escape`;

![printing](./public/changelog/assets/2.1.0/printing.webp)

#### Soltar archivos en pestañas

Arrastra archivos o directorios sobre pestañas para moverlos o copiarlos al directorio de otra pestaña.

- **Pestañas como destino**: las pestañas se convierten en destinos de soltar al arrastrar archivos en el navegador;
- **Activación al pasar el cursor**: mantén el cursor sobre una pestaña mientras arrastras para cambiar a ella antes de soltar los elementos;
- **Pestañas divididas**: los grupos de pestañas de directorios conservan su comportamiento habitual como destino sin alterar la estructura de la vista dividida;

![file-drop-to-tabs](./public/changelog/assets/2.1.0/file-drop-to-tabs.webp)

#### Vista previa de archivos en el panel de información

El panel de información ahora puede mostrar vistas previas de todos los tipos de archivo admitidos por la Vista rápida, no solo de imágenes y vídeos.

- **Vistas previas multimedia**: las imágenes usan miniaturas generadas, los vídeos y el audio incluyen controles nativos, y los PDF se muestran directamente en el panel;
- **Vistas previas de texto**: los archivos de texto muestran una vista previa compacta del texto decodificado, con un límite de tamaño seguro;
- **Alternativas**: los archivos y carpetas no admitidos siguen mostrando iconos genéricos;

![info-panel-file-preview](./public/changelog/assets/2.1.0/info-panel-file-preview.webp)

#### Columnas de lista del navegador

La vista de lista dispone de más columnas opcionales y ofrece un control más preciso de los metadatos mostrados.

- **Columna Creado**: muestra y ordena por fecha de creación;
- **Columna Etiquetas**: muestra etiquetas directamente en la vista de lista y añade, elimina o edita etiquetas desde la columna;

![navigator-list-columns](./public/changelog/assets/2.1.0/navigator-list-columns.webp)

### Extensiones

#### Temas de aplicación desde extensiones

Las extensiones ahora pueden aportar temas de color completos para la aplicación. Los temas instalados mediante extensiones aparecen en el selector de temas.

#### Temas de iconos desde extensiones

Las extensiones ahora pueden aportar temas de iconos del navegador para carpetas y archivos.

- **Elecciones separadas**: elige temas de iconos de carpetas y archivos de forma independiente en `Configuración > Apariencia de la interfaz > Tema de iconos`;
- **Temas integrados y de extensiones**: usa los temas de iconos predeterminados del sistema o cualquier tema proporcionado por una extensión habilitada;
- **Correspondencia de temas**: los temas aportados pueden definir iconos según la extensión o el nombre del archivo, el nombre de la carpeta y si esta está expandida;

### Nuevas configuraciones

- **Texto en negrita de la pestaña activa**: pone en negrita el título de la pestaña activa (`Configuración > Pestañas > Apariencia de pestañas > Texto en negrita de la pestaña activa`);

![bold-active-tab-text-setting](./public/changelog/assets/2.1.0/bold-active-tab-text-setting.webp)

### Nuevos atajos de teclado

- **Alternar vista dividida** (`Ctrl+S`): mostrar u ocultar la vista dividida en el navegador;
- **Restaurar pestaña cerrada** (`Ctrl+Shift+T`): restaurar el grupo de pestañas cerrado más recientemente;
- **Crear archivo / directorio** (`Ctrl+Shift+M` / `Ctrl+Shift+N`): crear un archivo o directorio nuevo en el directorio actual;
- **Imprimir archivo seleccionado** (`Ctrl+O`): imprimir el archivo seleccionado;
- **Abrir ruta copiada** (`Ctrl+Shift+V`): abrir una ruta válida del portapapeles;
- **Cambiar de página** (`Alt+1` - `Alt+5`): cambiar entre Inicio, Navegador, Panel de control, Configuración y Extensiones;
- **Historial de directorios** (`Alt+Left` / `Alt+Right`): ir atrás o adelante en el historial del navegador;
- **Ir al directorio superior** (`Alt+Up`): ir al directorio superior;
- **Botones de historial del ratón** (`Mouse Button 4` / `Mouse Button 5`): navegar atrás y adelante con los botones laterales del ratón;

![create-file-directory-shortcuts](./public/changelog/assets/2.1.0/create-file-directory-shortcuts.webp)

![navigator-shortcuts](./public/changelog/assets/2.1.0/navigator-shortcuts.webp)

### Mejoras de UX

#### Rendimiento en directorios grandes

La navegación, la búsqueda rápida y las carpetas con mucho contenido multimedia responden mejor y usan menos memoria.

- **Miniaturas generadas**: las miniaturas de imágenes y vídeos se generan en tamaños reducidos, en lugar de cargar el archivo multimedia completo en cada tarjeta;
- **Imágenes progresivas**: las tarjetas de imagen de la cuadrícula pueden mostrar una miniatura borrosa de baja resolución antes de que esté lista la miniatura final;
- **Cancelación de miniaturas**: la generación de miniaturas se puede cancelar cuando cambia la carpeta o las entradas visibles;
- **Rendimiento de renderizado**: las entradas de directorios grandes se renderizan de forma más eficiente y la Vista rápida utiliza miniaturas generadas en una lista virtual;

![low-res-image-thumbnail-preview](./public/changelog/assets/2.1.0/low-res-image-thumbnail-preview.webp)

#### Búsqueda rápida

La búsqueda rápida ahora tiene dos modos: pasivo y activo:

- **Modo pasivo**: se activa automáticamente al empezar a escribir, filtra las entradas sin enfocar el campo de búsqueda y permite seguir navegando;
- **Modo activo**: se activa con `Ctrl+F`, enfoca el campo de búsqueda e impide la navegación, pero permite controlar con más precisión el texto introducido;

Otros cambios:

- **Escribir para filtrar**: escribir teclas alfanuméricas ahora siempre inicia la búsqueda rápida (modo pasivo) en el panel activo;
- **Navegación por teclado**: el primer elemento coincidente se selecciona automáticamente;
- **Panel emergente**: el panel de búsqueda rápida es más compacto y evita cubrir los elementos del directorio;

![quick-search](./public/changelog/assets/2.1.0/quick-search.webp)

#### Editor de direcciones

El editor de direcciones ahora permite abrir una gama más amplia de rutas.

- **Archivos y directorios**: abre archivos además de directorios desde el editor de direcciones;
- **Rutas frecuentes**: cambia a un modo centrado en abrir rápidamente rutas usadas con frecuencia;
- **Sugerencias**: explora entradas de directorio, coincidencias exactas, rutas recientes, elementos etiquetados, carpetas de usuario y unidades del sistema;
- **Acciones de teclado**: navega hacia atrás, hacia delante o al directorio superior, y muestra una entrada en la carpeta que la contiene;

![address-editor](./public/changelog/assets/2.1.0/address-editor.webp)

#### Centro de estado

El centro de estado es ahora un control compacto de la barra de herramientas que organiza las operaciones con mayor claridad.

- **Recuento de operaciones activas**: el botón de la barra de herramientas se amplía para mostrar cuántas operaciones están en curso;
- **Grupos de operaciones**: las operaciones activas y completadas están separadas, con las completadas en una sección plegable;
- **Cancelar todo**: cancela operaciones activas en paralelo desde el encabezado de la sección;
- **Tarjetas de operaciones**: las tarjetas muestran con mayor claridad el tipo y el estado, por ejemplo, `Copiar | Éxito` o `Archivo | Error`;
- **Recuperación del portapapeles**: al pegar, el portapapeles se vacía en cuanto la operación entra en la cola y se restaura si esta falla;

![status-center](./public/changelog/assets/2.1.0/status-center.webp)

#### Navegación y pestañas

La navegación por el explorador y el comportamiento de las pestañas son ahora más predecibles.

- **Unidades de la barra lateral**: hacer clic en una unidad de la barra lateral de navegación la abre en la pestaña actual;
- **Directorio actual**: el segmento de la dirección que corresponde al directorio actual aparece más destacado y permite abrir su menú contextual con el botón derecho;
- **Pestañas cerradas**: las pestañas restauradas vuelven a su posición anterior, conservan las rutas renombradas y redirigen a Inicio si la ruta se ha eliminado;
- **Diseño adaptable**: los botones de navegación de la barra de herramientas se contraen antes, las barras de direcciones de la vista dividida pasan a una segunda fila en paneles muy estrechos, y las pestañas compactas mantienen una altura coherente;

![nav-sidebar-drive-current-tab](./public/changelog/assets/2.1.0/nav-sidebar-drive-current-tab.webp)

![current-directory-address-bar](./public/changelog/assets/2.1.0/current-directory-address-bar.webp)

#### Gestión de atajos

El editor de atajos ahora permite gestionar con mayor claridad los conflictos y la personalización.

- **Varias asignaciones**: asigna varios atajos a una acción;
- **Atajos sin asignar**: quita la asignación de atajos;
- **Sustitución en caso de conflicto**: sustituye un atajo en conflicto directamente desde el aviso;
- **Menú de la lista de atajos**: gestiona atajos desde un menú contextual en la lista de atajos;

![shortcut-editor](./public/changelog/assets/2.1.0/shortcut-editor.webp)

#### Arrastrar y soltar

Ahora es posible iniciar un arrastre hacia otra aplicación aunque cambies de ventana con `Alt+Tab`; ya no es necesario sacar el cursor de la ventana.

### Mejoras de interfaz

- **Anillo de selección**: mejorada la opacidad, el desplazamiento, el estilo del encabezado del panel y el comportamiento del foco de teclado del anillo de selección del navegador;
- **Barra de pestañas**: mejorados los estilos de la barra de pestañas y la legibilidad de la pestaña activa;
- **Selección de tema**: mejorado el diseño de la selección de tema;
- **Acceso rápido**: refinado el estilo del panel de acceso rápido;
- **Pantalla de inicio**: añadida una pantalla de inicio de la aplicación durante el arranque;
- **Visibilidad de los paneles emergentes**: mejorada la visibilidad de sus elementos translúcidos;
- **Información sobre herramientas**: añadida a más botones de la barra de herramientas;
- **Traducciones**: mejorados los textos en japonés y vietnamita y reorganizada la estructura de los idiomas;

![selection-ring](./public/changelog/assets/2.1.0/selection-ring.webp)

![tab-bar-styles](./public/changelog/assets/2.1.0/tab-bar-styles.webp)

![narrow-window-layout](./public/changelog/assets/2.1.0/narrow-window-layout.webp)

### Corrección de errores

- **Unidades asignadas**: se corrigió el arrastre de archivos desde unidades de red asignadas hacia otras aplicaciones;
- **Desplazamiento con teclado**: se corrigió un problema por el que la primera fila quedaba oculta tras el encabezado fijo;
- **Bloqueo al iniciar**: se corrigieron bloqueos poco frecuentes de varios minutos en Windows, causados por llamadas síncronas lentas al sistema durante el inicio y la búsqueda de actualizaciones;
- **Extracción de archivos**: se conservaron los permisos de archivo de Unix durante la extracción;
- **HTTP de extensiones**: se restauró el tratamiento permanente de respuestas distintas de 2xx y ahora se pueden cancelar las esperas entre reintentos;
- **Paleta de comandos**: se corrigió el botón de la barra de herramientas de la paleta de comandos cuando su atajo se personalizaba;
- **Selección por rango en cuadrícula**: se corrigió un problema por el que se seleccionaban entradas fuera del rango indicado;
- **Menús contextuales**: se corrigieron los menús del elemento seleccionado y del directorio actual que permanecían abiertos después de elegir una acción;
- **Registro de atajos**: se corrigieron errores al registrar atajos después de recargar la ventana;
- **Aplicación de temas**: se corrigió un problema por el que los temas seleccionados no se aplicaban en todas las ventanas;
- **Movimientos en macOS**: se corrigió la gestión de movimientos entre volúmenes y se admitieron los paquetes de aplicaciones como destino;
- **Administrador de archivos predeterminado**: se hizo más segura la restauración del registro de Windows cuando falla la activación del administrador de archivos predeterminado o se recuperan los valores anteriores del sistema;

![keyboard-scroll-floating-header](./public/changelog/assets/2.1.0/keyboard-scroll-floating-header.webp)

---
## [2.0.0-beta.3] - April 2026

**Resumen:** Sistema de extensiones con marketplace, compartir archivos en red local, menú de acceso rápido, archivos zip, unidades WSL, edición de etiquetas, vista rápida y búsqueda mejoradas, mejoras en efectos visuales, y numerosas mejoras de UX y estabilidad.

- [Nuevas funciones](#nuevas-funciones)
  - [Sistema de extensiones](#sistema-de-extensiones)
  - [Administrador de archivos predeterminado](#administrador-de-archivos-predeterminado)
  - [Compartir en red local](#compartir-en-red-local)
  - [Menú de acceso rápido](#menú-de-acceso-rápido)
  - [Archivos Zip](#archivos-zip)
  - [Detección de unidades WSL](#detección-de-unidades-wsl)
  - [Edición de etiquetas](#edición-de-etiquetas)
  - [Actualizaciones en la aplicación](#actualizaciones-en-la-aplicación)
  - [Copiar ruta](#copiar-ruta)
  - [Cerrar pestañas duplicadas](#cerrar-pestañas-duplicadas)
  - [Menús contextuales de inicio y panel de control](#menús-contextuales-de-inicio-y-panel-de-control)
  - [Modo de mezcla de efectos visuales](#modo-de-mezcla-de-efectos-visuales)
- [Nuevas configuraciones](#nuevas-configuraciones)
- [Nuevos atajos de teclado](#nuevos-atajos-de-teclado)
- [Nuevos idiomas](#nuevos-idiomas)
- [Mejoras de UX](#mejoras-de-ux)
  - [Mejoras en la vista rápida](#mejoras-en-la-vista-rápida)
  - [Mejoras en la búsqueda rápida](#mejoras-en-la-búsqueda-rápida)
  - [Operaciones de archivos](#operaciones-de-archivos)
  - [Efectos visuales](#efectos-visuales)
- [Mejoras de interfaz](#mejoras-de-interfaz)
- [Corrección de errores](#corrección-de-errores)

### Nuevas funciones

#### Sistema de extensiones

Sistema completo de extensiones con marketplace abierto.

- **Marketplace**: navega, instala y gestiona extensiones desde el marketplace;
- **Instalación local**: puedes instalar extensiones desde una carpeta local;
- **Paleta de comandos**: nueva forma de activar comandos de la aplicación y extensiones;
- **Capacidades**: las extensiones pueden registrar atajos locales y globales, elementos del menú contextual, configuraciones, páginas completas y comandos;
- **Versionado**: puedes instalar diferentes versiones de extensiones y habilitar la actualización automática;
- **Localización**: las extensiones pueden proporcionar traducciones para diferentes idiomas;
- **Gestión de binarios**: las extensiones pueden usar binarios (ffmpeg, deno, node, yt-dlp, 7z y cualquier otro binario existente);
- **Ejecución aislada**: las extensiones se ejecutan en sandboxes ESM aislados con permisos granulares;

#### Administrador de archivos predeterminado

Ahora puedes hacer que SFM sea el administrador de archivos predeterminado en Windows (`Configuración > Experimental`). Cuando esta configuración está habilitada, la mayoría de las acciones del sistema con archivos se redirigen a SFM:

- Icono de la aplicación Explorador de archivos;
- Atajo `Ctrl+E`;
- Mostrar archivo en carpeta;
- Mostrar descargas (cuando descargas un archivo en el navegador);
- Comandos de terminal: "start {ruta}", "code {ruta}", etc.
- Y más;

Las vistas nativas del sistema como "Papelera de reciclaje", "Panel de control" y otros programas profundamente integrados se delegan al Explorador de archivos nativo.

#### Compartir en red local

Comparte y transmite archivos y directorios a través de tu red local directamente desde la aplicación.

Accede a compartir en red local desde el botón de la barra de herramientas en el navegador o desde el menú contextual de cualquier archivo o directorio. Cuando se activa un recurso compartido, se muestran un código QR y URLs para compartir. Hay dos modos disponibles:

- **Transmisión**: transmite archivos y directorios a cualquier dispositivo en tu red a través de un navegador web;
- **FTP**: comparte archivos a través de FTP para acceso directo desde otras aplicaciones. Puedes tanto descargar como subir archivos desde y hacia el ordenador desde otro dispositivo;

#### Menú de acceso rápido

El botón "Panel de control" en la barra lateral ahora funciona como un menú de acceso rápido. Al pasar el cursor sobre él, se abre un panel que muestra tus elementos Favoritos y Etiquetados.

Todos los elementos del panel son entradas reales de directorio: puedes arrastrar y soltar elementos, abrir menús contextuales con clic derecho y realizar cualquier operación estándar con archivos.

Se puede desactivar en `Configuración > Apariencia de la interfaz > Abrir panel de acceso rápido al pasar el cursor`.

#### Archivos Zip

Comprime y extrae archivos zip directamente desde el menú de acciones del explorador de archivos:

- **Extraer**: extrae un archivo `.zip` al directorio actual o a una carpeta con nombre;
- **Comprimir**: comprime archivos y directorios seleccionados en un archivo `.zip`;

#### Detección de unidades WSL

En Windows, la aplicación ahora detecta automáticamente las distribuciones WSL instaladas y muestra sus unidades en el navegador, permitiéndote explorar los sistemas de archivos WSL de forma nativa.

#### Edición de etiquetas

Ahora puedes editar los nombres y colores de las etiquetas. Abre el selector de etiquetas en cualquier archivo o directorio para renombrar etiquetas, cambiar su color o eliminarlas.

#### Actualizaciones en la aplicación

Ahora puedes descargar e instalar actualizaciones directamente desde la notificación de actualización sin salir de la aplicación.

#### Copiar ruta

Se añadió la opción "Copiar ruta" al menú contextual de archivos y directorios.

#### Cerrar pestañas duplicadas

Se añadió la capacidad de cerrar pestañas duplicadas desde la barra de pestañas, eliminando todas las pestañas que apuntan al mismo directorio.

#### Menús contextuales de inicio y panel de control

Los elementos en la página de inicio y el panel de control ahora tienen menús contextuales completos, con la misma funcionalidad disponible en el navegador.

### Nuevas configuraciones

- **Mostrar banner multimedia de inicio**: mostrar u ocultar el banner multimedia de la página de inicio (`Configuración > Apariencia de la interfaz > Banner multimedia de la página de inicio`);
- **Retardo de tooltips**: configura el retardo antes de que aparezcan los tooltips (`Configuración > Apariencia de la interfaz > Tooltips`);
- **Tiempo relativo**: mostrar marcas de tiempo recientes en formato relativo, p. ej. "hace 5 min" (`Configuración > General > Fecha / hora`);
- **Formato de fecha y hora**: configura el formato del mes, formato regional, reloj de 12 horas, segundos y milisegundos (`Configuración > General > Fecha / hora`);
- **Desenfoque del fondo de diálogos**: establece la intensidad del desenfoque para los fondos de diálogos (`Configuración > Apariencia de la interfaz > Configuración de estilo`);
- **Filtros de brillo y contraste**: ajusta los filtros de brillo y contraste de la interfaz de la aplicación (`Configuración > Apariencia de la interfaz > Configuración de estilo`);
- **Brillo del multimedia de superposición**: ajusta el brillo del multimedia de superposición de efectos visuales (`Configuración > Apariencia de la interfaz > Efectos visuales`);
- **Modo de mezcla de efectos visuales**: ajusta el modo de mezcla para los efectos visuales, permitiéndote elegir cómo el multimedia de fondo se mezcla con la interfaz de la aplicación (`Configuración > Apariencia de la interfaz > Efectos visuales`);
- **Pausar video de fondo**: pausar el banner de inicio y el video de fondo cuando la aplicación está inactiva o minimizada (`Configuración > Apariencia de la interfaz > Efectos visuales`);
- **Administrador de archivos predeterminado**: establecer Sigma File Manager como el explorador de archivos predeterminado en Windows (`Configuración > Experimental`);
- **Iniciar al arrancar el sistema**: iniciar automáticamente la aplicación al iniciar sesión en el sistema (`Configuración > General > Comportamiento de inicio`);

### Nuevos atajos de teclado

- **Copiar ruta del directorio actual** (`Ctrl+Shift+C`): copiar la ruta del directorio actual al portapapeles;
- **Recargar directorio actual** (`F5`): actualizar la lista de archivos del navegador;
- **Acercar / alejar** (`Ctrl+=` / `Ctrl+-`): aumentar o disminuir el zoom de la interfaz;
- **Pantalla completa** (`F11`): alternar el modo de pantalla completa;

### Nuevos idiomas

- **Hindi**;
- **Urdu**;

### Mejoras de UX

#### Mejoras en la vista rápida

- **Navegación de multimedia**: navega entre archivos en el directorio actual sin cerrar la vista rápida;
- **Vista previa de archivos de texto**: vista previa mejorada de archivos de texto con detección de codificación adecuada, edición en línea y renderizado de markdown;

#### Mejoras en la búsqueda rápida

- **Todas las propiedades**: busca por cualquier propiedad de archivo — nombre, tamaño, cantidad de elementos, modificado, creado, accedido, ruta o tipo MIME (p. ej. `modified: today`, `mime: image`);
- **Rangos de tamaño**: filtra por tamaño usando comparaciones y rangos (p. ej. `size: >=2mb`, `size: 1mb..10mb`);

#### Operaciones de archivos

- **Seguridad en resolución de conflictos**: mejorada la seguridad de archivos en el modal de resolución de conflictos para prevenir la pérdida accidental de datos;
- **Pegado de un solo uso**: los elementos copiados solo pueden pegarse una vez, previniendo pegados duplicados accidentales;
- **Copiar texto**: permite copiar texto de la interfaz con `Ctrl+C` cuando no hay archivos seleccionados;

#### Efectos visuales

- **Gestor de fondos**: añadido gestor de fondos a la página de configuración para personalización centralizada del fondo;
- **Restablecer efectos de fondo**: añadido botón de restablecimiento en la configuración de efectos de fondo;

#### Otros

- **Reducción del tamaño de la aplicación**: reducido el tamaño del paquete de la aplicación al excluir fondos integrados de alta resolución y usar vistas previas comprimidas en el editor de banners multimedia;
- **Búsqueda global**: mostrar botón "mostrar configuración" en estado vacío y aumentada la profundidad de búsqueda predeterminada;
- **Accesos directos de Windows**: los archivos `.lnk` ahora abren su destino en el navegador en lugar de lanzarse externamente;
- **Panel de control**: mejorado el diseño de la sección de etiquetas;
- **Menú contextual de la barra de direcciones**: añadido menú contextual a los elementos de la barra de direcciones;
- **Menú contextual del navegador**: mostrar menú contextual al hacer clic en el área vacía del navegador;
- **Abrir en nueva pestaña**: abrir directorios en una nueva pestaña con clic del botón central del ratón;
- **Desplazamiento de pestañas**: las pestañas recién añadidas se desplazan automáticamente a la vista;
- **Foco del menú**: los menús ya no devuelven el foco a su botón de activación al cerrarse con un clic fuera;
- **Cerrar búsqueda**: cerrar la búsqueda global con `Escape`;
- **Inicio más rápido**: velocidad de inicio de la aplicación ligeramente mejorada mediante la precarga de configuraciones en Rust;
- **Directorios de usuario**: añadida la capacidad de agregar y eliminar directorios de usuario en la página de inicio;
- **Límites de listas**: reducidos los límites de las entradas de frecuentes e historial para mejorar el rendimiento;

### Mejoras de interfaz

- **Iconos de la barra de herramientas**: unificados los colores de los iconos de la barra de herramientas en toda la aplicación;
- **Animaciones de tarjetas**: añadidos efectos de aparición escalonada y desvanecimiento a las tarjetas;
- **Tema claro**: mejorados los colores y el contraste del tema claro;
- **Estabilidad de inicio**: mejorada la estabilidad visual durante el inicio de la aplicación para reducir el parpadeo;
- **Notificaciones**: mejorado el diseño de notificaciones para mayor consistencia;
- **Auto-desplazamiento de pestañas**: desplazamiento automático de la pestaña seleccionada a la vista al abrir la página del navegador;
- **Etiquetas de rutas raíz**: normalizadas las etiquetas de rutas raíz en pestañas y panel de información;
- **Traducciones**: mejoradas las traducciones en toda la aplicación;

### Corrección de errores

- Corregido el congelamiento de la interfaz al copiar o mover muchos elementos; añadido el progreso de operaciones de archivos al centro de estado;
- Corregido el congelamiento de la interfaz al eliminar muchos elementos; añadido el progreso de eliminación al centro de estado;
- Corregido el menú contextual en vista de cuadrícula que no se abría para el directorio actual cuando otro elemento ya tenía un menú abierto;
- Corregido el panel de información que no mostraba toda la información del directorio actual;
- Corregidos los atajos de teclado de la aplicación que se registraban en la ventana de vista rápida en lugar de solo en la ventana principal;
- Corregido el manejo de archivos arrastrados desde navegadores web;
- Corregidos los nombres de archivo de arrastres de URL externos que no mantenían segmentos válidos;
- Corregido el banner de inicio que era arrastrable;
- Corregida la caché de iconos del sistema que no se indexaba por ruta de archivo, causando iconos incorrectos;
- Corregidas las entradas raíz inaccesibles de Windows que aparecían en el navegador;
- Corregidos los atajos personalizados que no se identificaban en algunas distribuciones de teclado;
- Corregidas las conexiones SSHFS en Linux;
- Corregida la barra de direcciones que creaba entradas duplicadas en el historial al hacer clic en la ruta de navegación;
- Corregidos los resultados de búsqueda global que no respondían a la navegación por teclado;
- Corregidos los resultados de búsqueda global que no se abrían al hacer clic;
- Corregido el estado de búsqueda global que no se sincronizaba después de la indexación incremental;
- Corregido el arrastrar y soltar de archivos saliente que no funcionaba en algunas aplicaciones;
- Corregido el diseño inconsistente de insignias de atajos en toda la aplicación;
- Corregida la visibilidad de columnas del navegador en paneles estrechos;

---

## [2.0.0-beta.2] - February 2026

**Resumen:** Atajos globales, nuevas configuraciones, nuevas funciones, filtrado de archivos mejorado, barra de direcciones mejorada, mejoras del banner de inicio y correcciones de errores.

### Atajos globales

Ahora puedes usar atajos de teclado para interactuar con la aplicación incluso cuando no está en foco.

Atajos añadidos:

- `Win+Shift+E` para mostrar y enfocar la ventana de la aplicación;

### Nuevas configuraciones

Se añadió la configuración para elegir qué sucede cuando se cierra la última pestaña.

![Configuración cerrar última pestaña](./public/changelog/assets/beta-2/setting-close-last-tab.png)

### Nuevas funciones

Se añadieron nuevas funciones en vista previa temprana:

- Ubicaciones de red: permite conectar una ubicación de red (SSHFS (SSH) / NFS / SMB / CIFS);
- [Linux] Montaje de unidades: permite desmontar ubicaciones;

### Filtro de archivos

El filtro de archivos fue mejorado:
- Ahora al cambiar de directorio, se limpia y cierra automáticamente;
- La función "filtrar al escribir" se activa en el panel seleccionado, no en el primero;

### Barra de direcciones

- Diseño mejorado y lógica de autocompletado;
- Los separadores de ruta ahora son menús desplegables que proporcionan navegación rápida a cualquier directorio padre;

![Menús de separadores](./public/changelog/assets/beta-2/divider-menus.png)

### Banner de inicio / Efectos de fondo

- Diseño mejorado del editor de banners multimedia:
  - El menú de opciones del banner multimedia ahora se abre hacia abajo para evitar obstruir la vista;
  - Ahora puedes hacer clic fuera para cerrar el editor de posición del fondo;
  - La entrada de URL se movió encima de los fondos personalizados;
- Las imágenes/videos personalizados se pueden usar en los efectos visuales de fondo;
- Se eliminaron algunas imágenes predeterminadas del banner multimedia;
- Se añadió una nueva imagen de banner "Exile by Aleksey Hoffman";

### Mejoras de UX

- La aplicación restaura la posición anterior de la ventana al iniciar;
- La pestaña actual ahora se puede cerrar con el atajo `Ctrl+W` o clic del botón central del ratón;
- Aumentado el tamaño de los iconos de archivo en la vista de cuadrícula;

### Corrección de errores

- Corregido el movimiento de archivos entre pestañas que a veces los movía a la ubicación incorrecta;
- Corregido el navegador que a veces mostraba iconos del sistema incorrectos para directorios;
- Corregida la creación de múltiples instancias de la aplicación y la bandeja;
- Corregido el menú de extensiones de shell que actualizaba datos periódicamente, lo que forzaba la lista a desplazarse hacia arriba todo el tiempo;

## [2.0.0-beta.1] - February 2026

**Resumen:** Mejoras importantes de usabilidad y diseño, incluyendo navegación por teclado, nuevos atajos, abrir en terminal, auto-actualización de directorios, arrastrar y soltar, y búsqueda y vistas de lista mejoradas.

### Navegación por teclado

Navega por archivos usando el teclado con soporte completo para vistas de cuadrícula y lista y vista dividida.

- Teclas de flecha para navegación espacial en vista de cuadrícula y navegación secuencial en vista de lista;
- Enter para abrir el directorio o archivo seleccionado, Backspace para navegar hacia atrás;
- Ctrl+Left / Ctrl+Right para cambiar el foco entre paneles de vista dividida;
- Ctrl+T para abrir el directorio actual en una nueva pestaña;
- Todos los atajos de navegación son personalizables en Configuración > Atajos de teclado;

### Auto-actualización de directorios

La vista del navegador se actualiza automáticamente cuando se crean, eliminan, renombran o modifican archivos en el directorio actual.

- Los tamaños de archivo se actualizan automáticamente cuando son modificados por aplicaciones externas;
- Vigilancia eficiente del sistema de archivos con debouncing para evitar actualizaciones excesivas;
- Actualizaciones inteligentes basadas en diferencias que solo cambian los elementos afectados, preservando la posición de desplazamiento y la selección;

### Arrastrar y soltar

<video width="100%" mute autoplay loop controls src="./public/changelog/assets/beta-1/drag-and-drop.mp4"></video>

Ahora puedes arrastrar archivos y carpetas para copiarlos/moverlos con facilidad. Arrastra entre paneles, desde o hacia listas de resultados de búsqueda, desde o hacia aplicaciones externas.

### Conflictos de copia

Se añadió una ventana modal para facilitar la resolución de conflictos de copia/movimiento.

### Actualización automática

Se añadió la comprobación automática de actualizaciones (se puede controlar desde la configuración).

### Editor de banner multimedia de inicio

Se añadió un editor para personalizar el banner de la página de inicio. Ahora puedes subir imágenes y videos personalizados (se admiten tanto archivos locales como URLs remotas).

### Mejoras en la vista de lista

- Diseño mejorado y pequeñas molestias corregidas;
- Añadida personalización de visibilidad de columnas: elige qué columnas mostrar;
- Añadida ordenación por columnas: haz clic en los encabezados de columna para ordenar entradas;
- La vista de lista se estableció como vista predeterminada del navegador;

### Mejoras en la búsqueda global

- Diseño y layout actualizados con soporte de arrastrar y soltar;
- La búsqueda ahora está disponible mientras las unidades aún se están indexando;

### Abrir en terminal

Abre directorios en tu terminal preferido directamente desde el menú contextual.

- Detección automática de terminales instalados en Windows, macOS y Linux;
- Windows Terminal muestra todos los perfiles de shell configurados con iconos de ejecutables;
- El terminal predeterminado de Linux se detecta automáticamente y se muestra primero;
- Incluye modos normal y de administrador/elevado;
- Atajo predeterminado: Alt+T;

### Localización

- Se añadió el idioma esloveno (gracias a: @anderlli0053);

### Mejoras de interfaz y UX

- Añadido selector de fuentes: elige la fuente de la interfaz entre las fuentes del sistema instaladas;
- Añadido menú "Crear nuevo" para crear rápidamente archivos o directorios;
- Mostrando vista de estado vacío al navegar a directorios vacíos;
- La barra de estado muestra el total de elementos con el recuento oculto cuando la lista está filtrada;
- Los elementos recién creados, copiados y movidos se desplazan automáticamente a la vista;
- La barra de herramientas del portapapeles se muestra una vez debajo de los paneles en lugar de en cada panel;
- Diseño simplificado del modal de renombrado;
- Iconos de barra de herramientas responsivos que se colapsan en un menú desplegable con tamaños de ventana pequeños;
- Eliminada la pestaña vacía "Navegación" de la configuración;
- Renombrar un directorio ahora actualiza su ruta en todas las pestañas, espacios de trabajo, favoritos, etiquetas, historial y elementos frecuentes;
- Eliminar un archivo o directorio ahora lo elimina de todas las listas almacenadas y navega las pestañas afectadas al inicio;
- Las rutas inexistentes en favoritos, etiquetas, historial y elementos frecuentes ahora se limpian automáticamente al iniciar;

### Corrección de errores

- Corregido el estado de indexación de búsqueda global que no se actualizaba en tiempo real;
- Corregido el panel de vista dividida que no se actualizaba cuando su directorio era eliminado o renombrado desde el otro panel;
- Corregidas las pestañas que se cargaban con error cuando su ruta almacenada ya no existía;
- Corregidos los iconos del sistema que mostraban el mismo icono para todos los archivos del mismo tipo en lugar de iconos únicos por archivo;
- Corregidos los atajos de teclado que no funcionaban en el segundo panel de la vista dividida;
- Corregidos los atajos de teclado que dejaban de funcionar después de navegar entre páginas;
- Corregida la fuga de memoria con listeners de teclas del filtro que no se limpiaban al desmontar;
- Linux: añadido soporte para obtener la aplicación predeterminada en el menú "abrir con";

---

## [2.0.0-alpha.6] - January 2026

**Resumen:** Ventana de novedades, vista rápida, mejoras del menú contextual y nuevas configuraciones.

### Ventana de novedades

Una ventana de registro de cambios que muestra nuevas funciones y mejoras para cada versión.

- Aparece automáticamente después de las actualizaciones (se puede desactivar);
- Navega por todas las versiones;
- Descripciones detalladas y capturas de pantalla para cada función;

### Vista rápida

Previsualiza archivos sin abrirlos completamente usando una ventana de previsualización ligera.

- Presiona `Space` o la opción "Vista rápida" en el menú contextual para ver archivos rápidamente;
- Cierra instantáneamente con `Space` o `Escape`.
- Soporta imágenes, videos, audio, archivos de texto, PDFs y más;

<video width="100%" mute autoplay loop controls src="./public/changelog/assets/alpha-6/quick-view.mp4"></video>

### Cálculo del tamaño de directorios

- El tamaño de los directorios ahora se calcula automáticamente;
- Puedes ver el tamaño total de todos los directorios, incluyendo todos los subdirectorios y archivos, tan pronto como abras cualquier directorio;

![Abrir con](./public/changelog/assets/alpha-6/size.png)

### Nuevas opciones del menú contextual

#### Abrir con

- Elige con qué aplicación abrir un archivo;
- Configura presets personalizados para abrir archivos en aplicaciones con flags;
- Ve todas las aplicaciones compatibles para cualquier tipo de archivo;
- Establece aplicaciones predeterminadas para tipos de archivo específicos;

![Abrir con](./public/changelog/assets/alpha-6/open-with.png)

#### Extensiones de shell

- Accede a los elementos del menú contextual de shell de Windows;
- Accede a extensiones de shell de terceros (7-Zip, Git, etc.);

![Extensiones de shell](./public/changelog/assets/alpha-6/shell-extensions.png)

### Nuevas configuraciones

#### Detección de unidades

- Enfoca la aplicación cuando se conectan unidades extraíbles (se puede desactivar);
- Controla el comportamiento de apertura automática del Explorador de Windows para unidades extraíbles;

#### Filtrar al escribir

Comienza a escribir en cualquier lugar del navegador para filtrar instantáneamente los elementos en el directorio actual;

#### Atajo de búsqueda en configuración

Nuevo atajo de teclado para acceso rápido a la búsqueda en configuración;

#### Datos estadísticos del usuario

- Añadida sección de configuración de estadísticas;
- En la página del panel de control puedes ver, navegar y borrar historial, favoritos y elementos de uso frecuente;

### Mejoras de búsqueda

Búsqueda global mejorada con un sistema híbrido de búsqueda indexada + directa para resultados más fiables y actualizados.

- Las búsquedas ahora consistentemente toman menos de 1 segundo (~1 TB de disco completamente lleno), sin importar dónde estén los archivos en tus unidades;
- Cuando buscas en tus "rutas prioritarias" (las que abres frecuentemente), obtienes resultados instantáneamente y encuentra los archivos incluso si fueron recién creados y aún no fueron indexados.

#### Las rutas prioritarias incluyen:
- Directorios de usuario: Descargas, Documentos, Escritorio, Imágenes, Videos, Música;
- Favoritos;
- Abiertos recientemente;
- Usados frecuentemente;
- Etiquetados;

---

## [2.0.0-alpha.5] - January 2026

**Resumen:** Operaciones de archivos, búsqueda global y personalización de atajos de teclado.

### Búsqueda global

Potente búsqueda en todo el disco que indexa y busca archivos en todas tus unidades. Incluye coincidencia difusa para encontrar archivos incluso con errores tipográficos, re-indexación periódica automática, indexación prioritaria para directorios de uso frecuente y escaneo paralelo opcional para una indexación más rápida.

![Búsqueda global](./public/changelog/assets/alpha-5/search.png)

### Operaciones de archivos

Soporte completo de operaciones de archivos con funcionalidad de copiar, mover y eliminar, incluyendo seguimiento de progreso. También incluye el renombrado de archivos y carpetas en el lugar.

### Editor de atajos de teclado

Personaliza todos los atajos de teclado de la aplicación. Ve las asignaciones actuales, detecta conflictos y restablece los valores predeterminados.

### Mejoras del navegador

Añadida la opción de mostrar iconos nativos del sistema para archivos y directorios en lugar de glifos minimalistas. Las pestañas de navegación de configuración ahora se fijan a la página al desplazarse.

---

## [2.0.0-alpha.4] - January 2026

**Resumen:** Página de inicio, efectos visuales y opciones de personalización del usuario.

### Página de inicio

Una hermosa página de inicio con un banner multimedia animado, lista de unidades y acceso rápido a directorios comunes del usuario como Documentos, Descargas, Imágenes y más.

### Efectos visuales

Sección de efectos visuales personalizable en la configuración que añade desenfoque, opacidad y efectos de ruido al fondo de la aplicación. Soporta diferentes configuraciones para cada página.

### Editor de directorios de usuario

Personaliza tus tarjetas de directorio de usuario con títulos, iconos y rutas personalizados. Personaliza cómo aparecen tus directorios de acceso rápido en la página de inicio.

### Editor de posición del banner

Ajusta con precisión la posición de los fondos del banner de la página de inicio. Ajusta el zoom, posicionamiento horizontal y vertical para el aspecto perfecto.

### Mejoras de configuración

- La búsqueda en configuración ahora funciona en cualquier idioma, no solo en el actual;
- La aplicación restaurará la última pestaña de configuración visitada al recargar en lugar de abrir siempre la primera;

---

## [2.0.0-alpha.3] - December 2025

**Resumen:** Vista del navegador con pestañas, espacios de trabajo y un nuevo sistema de diseño.

### Vista del navegador

La experiencia principal de exploración de archivos con un sistema moderno de pestañas que soporta espacios de trabajo, un nuevo diseño de barra de herramientas de ventana con controles integrados y navegación de doble panel para una gestión eficiente de archivos.

### Miniaturas de video

Se añadieron miniaturas de previsualización para archivos de video en el navegador.

### Migración del sistema de diseño

Se migró la aplicación de Vuetify a Sigma-UI para un diseño más espacioso y moderno con mejor calidad de código.

---

## [2.0.0-alpha.1] - January 2024

**Resumen:** Reescritura completa usando tecnologías modernas.

### Migración a Tauri

Sigma File Manager v2 ha sido reconstruido desde cero usando Vue 3 Composition API, TypeScript y Tauri v2. El tamaño de instalación de la aplicación se redujo de 153 MB a solo 4 MB en Windows. El tamaño de la aplicación instalada se redujo de 419 MB a 12 MB.

### Paneles redimensionables

Se añadió la función de paneles redimensionables que permite dividir la vista del navegador a la mitad y trabajar con 2 directorios lado a lado.

### Funciones iniciales

Navegación básica de archivos con listado de directorios, gestión de ventanas con controles de minimizar, maximizar y cerrar, y una estructura inicial de página de configuración.
