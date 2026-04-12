# Registro de cambios

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
