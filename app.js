// ==========================================
// ☁️ CONFIGURACIÓN Y CONEXIÓN CON SUPABASE
// ==========================================
const SUPABASE_URL = "https://hlrlyyvddvtbvmzariuf.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhscmx5eXZkZHZ0YnZtemFyaXVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzNjYwOTcsImV4cCI6MjEwMzk0MjA5N30.68jzBUOJ0soaTTyNH1T4yRRsHxR0AZLq0nwjodbK7d4"; // Tu etiqueta original

// 🔗 EL ALIAS MÁGICO: Decimos que SUPABASE_KEY es exactamente igual a SUPABASE_ANON_KEY [Source 14]
// Así, el código de la biblioteca encuentra la llave bajo su nuevo nombre sin romper la línea 10.
const SUPABASE_KEY = SUPABASE_ANON_KEY; 

const MI_EMAIL = 'carlos@escuelabaloncesto.com';

// 🌟 Renombramos a 'supabaseClient' para evitar que choque con el CDN
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Coordenadas Iniciales por Defecto de las 11 fichas
const POSICIONES_INICIALES = {
    'token-a1': { x: 42, y: 50 },
    'token-a2': { x: 35, y: 25 },
    'token-a3': { x: 35, y: 75 },
    'token-a4': { x: 25, y: 35 },
    'token-a5': { x: 20, y: 65 },
    'token-d1': { x: 32, y: 50 },
    'token-d2': { x: 25, y: 22 },
    'token-d3': { x: 25, y: 78 },
    'token-d4': { x: 15, y: 40 },
    'token-d5': { x: 10, y: 60 },
    'token-ball': { x: 45, y: 50 }
};

// =======================================================================
// 🌟 NUEVO SITIO: VARIABLES DE ESTADO DEL REPRODUCTOR (MUDADAS AL TEJADO)
// =======================================================================
let reproductorIntervalo = null;
let estaReproduciendo = false;
const btnPlayPause = document.getElementById('btn-play-pause');
const btnAddStep = document.getElementById('btn-add-step');
const btnDeleteStep = document.getElementById('btn-delete-step');
// 🔌 Presentamos el botón de nueva jugada en la planta alta
const btnClearAll = document.getElementById('btn-clear-all');

// Variables de Estado de la Aplicación
let rolActual = 'entrenador'; // 'entrenador' o 'admin'
let jugadaPasos = []; // Secuencia de pasos tácticos en memoria
let pasoActivoIndex = 0; // Índice del paso visible en pantalla
let historialMovimientos = []; // Pila LIFO para deshacer movimientos
let jugadaActivaId = null; // ID de la jugada cargada de localStorage
let nombreJugadaActiva = "Lienzo Nuevo";
let esJugadaOficialActiva = false; // Indica si la jugada abierta es de la escuela
let tieneCambiosSinGuardar = false;
let modoLocalDeEmergencia = false;

// Referencias del DOM
const court = document.getElementById('basketball-court');
const tokens = document.querySelectorAll('.token');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const stepIndicator = document.getElementById('step-indicator');
const playTitleDisplay = document.getElementById('play-title-display');
const btnDuplicate = document.getElementById('btn-duplicate');
const listPersonal = document.getElementById('list-personal');
const listSchool = document.getElementById('list-school');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const btnUndo = document.getElementById('btn-undo');


// =======================================================================
// 🧠 BLOQUE 1: VARIABLES DE ESTADO GLOBAL (NUESTRO ARCHIVADOR)
// =======================================================================


// Inicializar Aplicación al cargar la ventana
window.addEventListener('load', () => {
    inicializarLienzoNuevo();
    cargarBiblioteca();
    configurarArrastre();
    comprobarConectividad();
});

if (btnPlayPause) {
    btnPlayPause.addEventListener('click', alternarReproduccion);
}

if (btnUndo) {
    btnUndo.addEventListener('click', deshacerUltimoMovimiento);
}

if (btnClearAll) {
    btnClearAll.addEventListener('click', iniciarNuevaJugada);
}

// 1. INICIALIZAR LIENZO NUEVO
function inicializarLienzoNuevo() {
    jugadaPasos = [JSON.parse(JSON.stringify(POSICIONES_INICIALES))]; // Paso semilla
    pasoActivoIndex = 0;
    historialMovimientos = [];
    jugadaActivaId = null;
    nombreJugadaActiva = "Lienzo Nuevo";
    esJugadaOficialActiva = false;
    tieneCambiosSinGuardar = false;
    
    aplicarPosicionesPantalla(jugadaPasos[0]);
    actualizarUI();
}

// 2. ACCIÓN BOTÓN NUEVA JUGADA
function nuevaJugada() {
    if (tieneCambiosSinGuardar) {
        const confirmar = confirm("⚠️ Tienes cambios sin guardar en esta jugada táctica. ¿Estás seguro de que quieres limpiar el lienzo y empezar una Nueva Jugada?");
        if (!confirmar) return; // Retorno anticipado
    }
    inicializarLienzoNuevo();
    mostrarToast("Lienzo reiniciado. ¡Empieza a diseñar!");
}

// 3. APLICAR COORDENADAS A LA PANTALLA TÁCTIL
function aplicarPosicionesPantalla(posiciones) {
    for (let id in posiciones) {
        const tokenElement = document.getElementById(id);
        if (tokenElement) {
            tokenElement.style.left = `${posiciones[id].x}%`;
            tokenElement.style.top = `${posiciones[id].y}%`;
        }
    }
}

// 4. CONFIGURAR DRAG & DROP MULTITÁCTIL CON LÍMITES SEGUROS
function configurarArrastre() {
    // 🌟 Eliminamos las pausas de aquí arriba, porque este sitio solo se ejecuta al cargar la web.
    
    let isDragging = false;
    let activeToken = null;

    // Esta es la función que reacciona en el instante exacto en que se toca una ficha
    function startDrag(e) {
        const token = e.target.closest('.token');
        if (!token || (esJugadaOficialActiva && rolActual === 'entrenador')) return; // Bloqueo si es oficial solo lectura

        // =======================================================================
        // 🔌 CONEXIÓN DE SEGURIDAD (EL DEDO ES EL REY)
        // Colocamos las pausas justo aquí dentro, para que se activen al tocar la ficha [Source 19].
        // =======================================================================
        detenerReproduccion();
        if (btnPlayPause) btnPlayPause.innerHTML = "▶ Reproducir";

        if (animacionIntervalo) {
            clearInterval(animacionIntervalo);
            animacionIntervalo = null;
        }
        // =======================================================================

        isDragging = true;
        activeToken = token;
        
        // Retiramos la animación suave para que el arrastre sea reactivo
        activeToken.classList.remove('animate-transition');
        court.appendChild(token); // Traer al frente
        
        // Guardar foto del estado anterior para el deshacer (Push)
        guardarEstadoEnHistorial();
    }

    function drag(e) {
        if (!isDragging || !activeToken) return;
        e.preventDefault();

        const rect = court.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        let xPercent = ((clientX - rect.left) / rect.width) * 100;
        let yPercent = ((clientY - rect.top) / rect.height) * 100;

        // FASE 2: Lógica de Límites Físicos (Margen de Radio del 2.25%)
        const LIMIT_MIN = 2.25;
        const LIMIT_MAX = 97.75;

        if (xPercent < LIMIT_MIN) xPercent = LIMIT_MIN;
        else if (xPercent > LIMIT_MAX) xPercent = LIMIT_MAX;

        if (yPercent < LIMIT_MIN) yPercent = LIMIT_MIN;
        else if (yPercent > LIMIT_MAX) yPercent = LIMIT_MAX;

        activeToken.style.left = `${xPercent}%`;
        activeToken.style.top = `${yPercent}%`;
    }

    function stopDrag() {
    if (isDragging && activeToken) {
        const xPercent = parseFloat(activeToken.style.left) || 0;
        const yPercent = parseFloat(activeToken.style.top) || 0;
        
        jugadaPasos[pasoActivoIndex][activeToken.id] = { x: xPercent, y: yPercent };
        tieneCambiosSinGuardar = true;
        
        // 💾 GUARDADO AUTOMÁTICO AL SOLTAR LA FICHA:
        guardarEnLocalStorage();
    }
    isDragging = false;
    activeToken = null;
    }

    // Instalamos los cables de escucha en la pantalla [Source 19]
    court.addEventListener('mousedown', startDrag);
    window.addEventListener('mousemove', drag);
    window.addEventListener('mouseup', stopDrag);

    court.addEventListener('touchstart', startDrag, { passive: false });
    window.addEventListener('touchmove', drag, { passive: false });
    window.addEventListener('touchend', stopDrag);
} // 🌟 ¡SOLUCIONADO! Ahora solo hay una llave de cierre al final de la función.


// 5. HISTORIAL DE DESHACER (PILA LIFO)
function guardarEstadoEnHistorial() {
    const copiaEstado = JSON.parse(JSON.stringify(jugadaPasos[pasoActivoIndex]));
    historialMovimientos.push(copiaEstado);
    
    if (historialMovimientos.length > 20) {
        historialMovimientos.shift();
    }
}

function deshacerMovimiento() {
    if (historialMovimientos.length === 0) {
        mostrarToast("Ya estás en el estado inicial de este paso.");
        return;
    }

    const estadoAnterior = historialMovimientos.pop();
    jugadaPasos[pasoActivoIndex] = estadoAnterior;
    
    aplicarAnimacionTemporal();
    aplicarPosicionesPantalla(estadoAnterior);
    tieneCambiosSinGuardar = true;
}

// 6. GESTIÓN DE PASOS Y LÍNEA DE TIEMPO
function crearNuevoPaso() {
    const pasoClonado = JSON.parse(JSON.stringify(jugadaPasos[pasoActivoIndex]));
    jugadaPasos.splice(pasoActivoIndex + 1, 0, pasoClonado);
    pasoActivoIndex++;
    historialMovimientos = [];
    tieneCambiosSinGuardar = true;

    aplicarPosicionesPantalla(jugadaPasos[pasoActivoIndex]);
    actualizarUI();
    mostrarToast(`Paso ${pasoActivoIndex + 1} creado a partir del anterior.`);
}

function cambiarPaso(direccion) {
    const nuevoIndex = pasoActivoIndex + direccion;
    if (nuevoIndex < 0 || nuevoIndex >= jugadaPasos.length) return;

    pasoActivoIndex = nuevoIndex;
    historialMovimientos = [];

    aplicarAnimacionTemporal();
    aplicarPosicionesConAnimacion(jugadaPasos[pasoActivoIndex], 500);
    actualizarUI();
}

function aplicarAnimacionTemporal() {
    tokens.forEach(token => token.classList.add('animate-transition'));
    setTimeout(() => {
        tokens.forEach(token => token.classList.remove('animate-transition'));
    }, 600);
}

// 7. ROLES Y AUTORIZACIÓN
function cambiarRol(nuevoRol) {
    // PASO 1: Reasignamos el valor en tu variable original
    rolActual = nuevoRol;

    // PASO 2: Localizamos el body y los botones
    const cuerpoPantalla = document.body;
    const botonEntrenador = document.getElementById('btn-role-coach');
    const botonAdministrador = document.getElementById('btn-role-admin');

    // PASO 3: Cambiamos las clases del body según el rol
    if (nuevoRol === 'admin') {
        cuerpoPantalla.classList.add('rol-admin');
        cuerpoPantalla.classList.remove('rol-entrenador');
        if (botonAdministrador) botonAdministrador.classList.add('active');
        if (botonEntrenador) botonEntrenador.classList.remove('active');
    } else {
        cuerpoPantalla.classList.add('rol-entrenador');
        cuerpoPantalla.classList.remove('rol-admin');
        if (botonEntrenador) botonEntrenador.classList.add('active');
        if (botonAdministrador) botonAdministrador.classList.remove('active');
    }

    // =========================================================================
    // 🔄 RE-RENDERIZADO DE LA BIBLIOTECA (¡LA SOLUCIÓN!)
    // =========================================================================
    // Le decimos a la barra lateral que se redibuje por completo. 
    // Al redibujarse ahora como Admin, ¡aparecerán mágicamente las papeleras de borrar!
    if (typeof cargarBiblioteca === 'function') {
        cargarBiblioteca();
    }

    // Refrescamos el marcador superior
    if (typeof actualizarUI === 'function') {
        actualizarUI();
    }
}

// 8. GUARDADO DE JUGADAS CON SISTEMA ANTIFALLOS
async function guardarJugada() {
    const nombreSugerido = (nombreJugadaActiva === "Lienzo Nuevo") ? "" : nombreJugadaActiva;
    const nombreIntroducido = prompt("Escribe el nombre de la jugada táctica:", nombreSugerido);
    if (nombreIntroducido === null) return; 
    
    const nombreLimpio = nombreIntroducido.trim();
    if (nombreLimpio === "") {
        alert("❌ ¡Error! No puedes guardar una jugada sin ponerle un nombre.");
        return;
    }

    let correoLimpio = "Entrenador Local";
    
    // Si la nube funciona, le pedimos el correo de firma
    if (!modoLocalDeEmergencia) {
        const correoSugerido = localStorage.getItem('ultimo_entrenador_email') || "";
        const correoIntroducido = prompt("Por favor, escribe tu correo de entrenador para firmar tu trabajo:", correoSugerido);
        if (correoIntroducido === null) return;

        correoLimpio = correoIntroducido.trim();
        if (correoLimpio === "" || !correoLimpio.includes('@')) {
            alert("❌ ¡Error! Debes introducir un correo electrónico válido.");
            return;
        }
        localStorage.setItem('ultimo_entrenador_email', correoLimpio);
    }

    // Si ya tiene un ID local o si estamos en modo emergencia, generamos un identificador local
    const idJugada = (jugadaActivaId && !jugadaActivaId.startsWith('local_')) 
        ? jugadaActivaId 
        : 'local_' + Date.now();

    const nuevaJugadaObjeto = {
        id: idJugada,
        nombre: nombreLimpio,
        pasos: jugadaPasos,
        creador_email: correoLimpio,
        es_oficial: !modoLocalDeEmergencia && (rolActual === 'admin')
    };

    // Desvío de emergencia inmediato
    if (modoLocalDeEmergencia) {
        guardarEnLocal(nuevaJugadaObjeto);
        return;
    }

    mostrarToast("☁️ Guardando en la nube de Supabase...");

    try {
        let response;
        if (jugadaActivaId && !jugadaActivaId.startsWith('local_')) {
            // Actualización en Supabase
            response = await supabaseClient
                .from('jugadas')
                .update({
                    nombre: nombreLimpio,
                    pasos: jugadaPasos,
                    creador_email: correoLimpio,
                    es_oficial: (rolActual === 'admin')
                })
                .eq('id', jugadaActivaId);
        } else {
            // Inserción nueva en Supabase
            const objParaInsertar = {
                nombre: nombreLimpio,
                pasos: jugadaPasos,
                creador_email: correoLimpio,
                es_oficial: (rolActual === 'admin')
            };
            response = await supabaseClient
                .from('jugadas')
                .insert([objParaInsertar])
                .select();
                
            if (response.data && response.data[0]) {
                jugadaActivaId = response.data[0].id;
            }
        }

        if (response.error) throw response.error;

        nombreJugadaActiva = nombreLimpio;
        tieneCambiosSinGuardar = false;

        await cargarBiblioteca();
        actualizarUI();
        mostrarToast(`💾 ¡Éxito! "${nombreLimpio}" guardada en la nube.`);

    } catch (error) {
        console.warn("⚠️ Error al guardar en la nube. Desviando a guardado local de emergencia...", error);
        // Marcamos el fallo para que las siguientes acciones vayan directas a local
        modoLocalDeEmergencia = true;
        // Nos aseguramos de ponerle etiqueta de ID local
        nuevaJugadaObjeto.id = 'local_' + Date.now();
        guardarEnLocal(nuevaJugadaObjeto);
    }
}

// 9. COPIAR JUGADA OFICIAL PARA EDITARLA
async function duplicarJugadaOficial() {
    // 1. Verificación de seguridad: solo duplicamos si hay una jugada oficial abierta
    if (!esJugadaOficialActiva) {
        if (typeof mostrarToast === 'function') {
            mostrarToast("⚠️ Abre una jugada oficial para poder duplicarla.");
        }
        return;
    }

    // 2. Confirmación dinámica usando comillas invertidas (Interpolación de Cadenas)
    const confirmar = confirm(`¿Quieres hacer una copia de "${nombreJugadaActiva}" en tus jugadas personales para poder editarla?`);
    if (!confirmar) return;

    // 3. Preparación de la nueva Ficha (Objeto en Memoria)
    const nuevoId = 'jugada_' + Date.now().toString();
    const nuevoNombre = `Copia de ${nombreJugadaActiva}`;
    
    // Clonación profunda (Deep Copy) para romper la referencia en memoria
    const pasosClonados = JSON.parse(JSON.stringify(jugadaPasos));

    // Objeto ensamblado con la estructura requerida por Supabase
    const nuevaJugada = {
        id: nuevoId,
        nombre: nuevoNombre,
        es_oficial: false, // 🔒 Se guarda como personal (no oficial)
        creador_email: (typeof usuarioEmailActual !== 'undefined' && usuarioEmailActual) 
                        ? usuarioEmailActual 
                        : 'entrenador@escuela.com',
        pasos: pasosClonados
    };

    // 4. Intento de guardado asíncrono en la Nube (Supabase)
    try {
        if (typeof mostrarToast === 'function') {
            mostrarToast("⏳ Guardando copia en tu cuenta de la nube...");
        }

        // Petición a la base de datos central y ESPERA de confirmación
        const { data, error } = await supabaseClient
            .from('jugadas')
            .insert([nuevaJugada]);

        if (error) throw error; // Si la nube devuelve un fallo, saltamos al catch

        // 5. Refresco y apertura automática tras la confirmación de la nube
        await cargarBiblioteca(); // Redibuja el menú lateral incorporando el nuevo clon
        cargarJugada(nuevoId, false); // Abre el duplicado personal en el lienzo
        
        if (typeof mostrarToast === 'function') {
            mostrarToast(`📋 ¡Copia "${nuevoNombre}" creada con éxito en la nube!`);
        }

    } catch (error) {
        console.error("⚠️ Error al duplicar en la nube, activando plan B local:", error);
        
        // 6. Plan B de Emergencia: Guardado en almacenamiento local (localStorage)
        let jugadasLocales = JSON.parse(localStorage.getItem('jugadas_locales_baloncesto')) || [];
        
        // Asignamos matrícula de emergencia local
        nuevaJugada.id = 'local_' + Date.now().toString(); 
        jugadasLocales.push(nuevaJugada);
        localStorage.setItem('jugadas_locales_baloncesto', JSON.stringify(jugadasLocales));

        // Refrescamos en modo local y abrimos la jugada
        cargarBibliotecaDesdeLocal();
        cargarJugada(nuevaJugada.id, false);
        
        if (typeof mostrarToast === 'function') {
            mostrarToast(`⚡ Guardado local de emergencia: "${nuevoNombre}"`);
        }
    }
}

// 10. EDITAR NOMBRE DE JUGADAS
function editarNombreJugada(e, id, esOficial) {
    e.stopPropagation();
    
    const claveGuardado = esOficial ? 'jugadas_oficiales_escuela' : 'jugadas_personales_entrenador';
    let listado = JSON.parse(localStorage.getItem(claveGuardado)) || [];
    const jugada = listado.find(j => j.id === id);
    
    if (!jugada) return;

    const nuevoNombre = prompt("Escribe el nuevo nombre para la jugada:", jugada.nombre);
    if (nuevoNombre === null) return;

    const nombreLimpio = nuevoNombre.trim();
    if (nombreLimpio === "") {
        alert("❌ ¡Error! El nombre no puede estar vacío.");
        return;
    }

    jugada.nombre = nombreLimpio;
    localStorage.setItem(claveGuardado, JSON.stringify(listado));

    if (jugadaActivaId === id) {
        nombreJugadaActiva = nombreLimpio;
    }

    cargarBiblioteca();
    actualizarUI();
    mostrarToast(`✏️ Jugada renombrada a: "${nombreLimpio}"`);
}

// 11. ELIMINAR JUGADAS (NUBE O LOCAL)
async function borrarJugada(e, id, esOficial) {
    e.stopPropagation();

    const confirmar = confirm("⚠️ ¿Estás seguro de que quieres eliminar esta jugada de forma permanente?");
    if (!confirmar) return;

    // Si es una jugada local
    if (modoLocalDeEmergencia || (typeof id === 'string' && id.startsWith('local_'))) {
        let jugadasLocales = JSON.parse(localStorage.getItem('jugadas_locales_baloncesto')) || [];
        jugadasLocales = jugadasLocales.filter(j => j.id !== id);
        localStorage.setItem('jugadas_locales_baloncesto', JSON.stringify(jugadasLocales));

        if (jugadaActivaId === id) {
            inicializarLienzoNuevo();
        }

        cargarBibliotecaDesdeLocal();
        mostrarToast("🗑️ Jugada local eliminada con éxito.");
        return;
    }

    // Borrado oficial de Supabase
    try {
        const { error } = await supabaseClient
            .from('jugadas')
            .delete()
            .eq('id', id);

        if (error) throw error;

        if (jugadaActivaId === id) {
            inicializarLienzoNuevo();
        }

        await cargarBiblioteca();
        mostrarToast("🗑️ Jugada eliminada de la nube con éxito.");

    } catch (error) {
        console.error("Error al borrar en Supabase:", error);
        mostrarToast("❌ No tienes permisos o falló la conexión al borrar.");
    }
}

// 12. GESTIÓN DE LA CARGA DE JUGADAS (NUBE O LOCAL)
async function cargarJugada(id, esOficial) {
    if (tieneCambiosSinGuardar) {
        const confirmar = confirm("⚠️ Tienes cambios sin guardar. ¿Quieres descartarlos para abrir esta jugada?");
        if (!confirmar) return;
    }

    // Si la jugada tiene ID local, la leemos directamente del disco duro
    if (modoLocalDeEmergencia || (typeof id === 'string' && id.startsWith('local_'))) {
        const jugadasLocales = JSON.parse(localStorage.getItem('jugadas_locales_baloncesto')) || [];
        const jugada = jugadasLocales.find(j => j.id === id);
        
        if (jugada) {
            jugadaPasos = JSON.parse(JSON.stringify(jugada.pasos));
            pasoActivoIndex = 0;
            historialMovimientos = [];
            jugadaActivaId = id;
            nombreJugadaActiva = jugada.nombre;
            esJugadaOficialActiva = false;
            tieneCambiosSinGuardar = false;

            aplicarAnimacionTemporal();
            aplicarPosicionesPantalla(jugadaPasos);
            actualizarUI();
            mostrarToast(`📖 Jugada local cargada: "${nombreJugadaActiva}"`);
        } else {
            mostrarToast("❌ No se encontró la jugada en el dispositivo.");
        }
        return;
    }

    // Ruta de carga habitual de Supabase
    try {
        const { data: jugada, error } = await supabaseClient
            .from('jugadas')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        jugadaPasos = JSON.parse(JSON.stringify(jugada.pasos));
        pasoActivoIndex = 0;
        historialMovimientos = [];
        jugadaActivaId = id;
        nombreJugadaActiva = jugada.nombre;
        esJugadaOficialActiva = esOficial;
        tieneCambiosSinGuardar = false;

        aplicarAnimacionTemporal();
        aplicarPosicionesPantalla(jugadaPasos);
        actualizarUI();
        mostrarToast(`📖 Jugada cargada: "${nombreJugadaActiva}"`);

    } catch (error) {
        console.error("Error al cargar de Supabase:", error);
        mostrarToast("❌ Error al descargar de la nube. Intentando cargar en local...");
    }
}

// 13. ACTUALIZAR PANEL DE BIBLIOTECA (CON AUTO-RESCATE LOCAL)
async function cargarBiblioteca() {
    // Ejecutamos primero la ocultación o muestra del botón Administrador
    actualizarMenuSegunRol(); 
    
    try {
        // Consultamos el catálogo general a la nube de Supabase
        const { data: listadoJugadas, error } = await supabaseClient
            .from('jugadas')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        modoLocalDeEmergencia = false;

        // 🎯 [AJUSTE 1: LA DOBLE CONDICIÓN DE PRIVACIDAD]
        // Se exige que NO sea oficial Y ADEMÁS que el creador sea el usuario en sesión
        const personales = listadoJugadas.filter(j => 
            j.es_oficial === false && j.creador_email === usuarioEmailActual
        );

        // Las jugadas oficiales de la escuela se mantienen públicas para todos
        const oficiales = listadoJugadas.filter(j => j.es_oficial === true);

        // --- PINTAR COLUMNA "MIS JUGADAS" (NUBE) ---
        listPersonal.innerHTML = "";
        if (personales.length === 0) {
            listPersonal.innerHTML = '<div style="color: #64748b; font-size: 0.8rem; padding: 5px;">Ninguna jugada privada en la nube.</div>';
        } else {
            personales.forEach(j => {
                const activeClass = (jugadaActivaId === j.id) ? 'active' : '';
                listPersonal.innerHTML += `
                    <div class="play-item ${activeClass}" onclick="cargarJugada('${j.id}', false)">
                        <div>
                            <span>🏀 ${j.nombre}</span>
                            <div style="font-size: 0.7rem; color: #94a3b8; margin-top: 2px;">Por: ${j.creador_email}</div>
                        </div>
                        <div class="play-item-actions">
                            <button class="action-icon" title="Borrar" onclick="borrarJugada(event, '${j.id}', false)">🗑️</button>
                        </div>
                    </div>
                `;
            });
        }

        // --- PINTAR COLUMNA "ESCUELA" (NUBE) ---
        listSchool.innerHTML = "";
        if (oficiales.length === 0) {
            listSchool.innerHTML = '<div style="color: #64748b; font-size: 0.8rem; padding: 5px;">Ninguna jugada oficial.</div>';
        } else {
            oficiales.forEach(j => {
                const activeClass = (jugadaActivaId === j.id) ? 'active' : '';
                console.log("🔍 Rol leído en la biblioteca:", rolActual);
                
                // Las papeleras de borrado en la escuela SOLO se muestran al Admin
                const showActions = (rolActual === 'admin');
                
                listSchool.innerHTML += `
                    <div class="play-item ${activeClass}" onclick="cargarJugada('${j.id}', true)">
                        <div>
                            <span>🏆 ${j.nombre}</span>
                            <div style="font-size: 0.7rem; color: #94a3b8; margin-top: 2px;">Oficial Escuela</div>
                        </div>
                        ${showActions ? `
                            <div class="play-item-actions">
                                <button class="action-icon" title="Borrar" onclick="borrarJugada(event, '${j.id}', true)">🗑️</button>
                            </div>
                        ` : '<div></div>'}
                    </div>
                `;
            });
        }

    } catch (error) {
        console.warn("⚠️ Supabase no disponible. Activando Modo Local de Emergencia:", error);
        modoLocalDeEmergencia = true;
        cargarBibliotecaDesdeLocal();
    }
}

// 14. COMPORTAMIENTO DINÁMICO DE INTERFAZ (UI)
// =========================================================================
// 🧠 CENTRALIZACIÓN DE INTERFAZ: ACTUALIZAR PANTALLA SEGÚN ROL Y JUGADA
// =========================================================================
function actualizarUI() {
    // 1. Actualizamos el título de la jugada en la barra superior
    playTitleDisplay.textContent = `${nombreJugadaActiva} ${tieneCambiosSinGuardar ? '*' : ''}`;
    
    // 2. Controlamos el apagado/encendido de los botones de la línea de tiempo
    btnPrev.disabled = (pasoActivoIndex === 0);
    btnNext.disabled = (pasoActivoIndex === jugadaPasos.length - 1);
    stepIndicator.textContent = `Paso: ${pasoActivoIndex + 1} / ${jugadaPasos.length}`;

    // 3. El semáforo de la botonera oficial frente a duplicación
    if (esJugadaOficialActiva && rolActual === 'entrenador') {
        btnDuplicate.style.display = 'block';
        document.querySelector('.btn-action.primary').disabled = true; // Desactiva guardar para entrenador
    } else {
        btnDuplicate.style.display = 'none';
        document.querySelector('.btn-action.primary').disabled = false;
    }

    // 4. Calculamos el interruptor maestro de Solo Lectura (¡Tu gran acierto!)
    const isReadOnly = (esJugadaOficialActiva && rolActual === 'entrenador');
    }

// 15. RED Y CONECTIVIDAD (ONLINE / OFFLINE)
function comprobarConectividad() {
    function toggleStatus() {
        const isOnline = navigator.onLine;
        statusDot.classList.toggle('offline', !isOnline);
        statusText.textContent = isOnline ? 'Online' : 'Offline (Local)';
        
        if (isOnline) {
            mostrarToast("📶 Conexión recuperada. Sincronización automática activa.");
        } else {
            mostrarToast("⚠️ Dispositivo fuera de línea. Guardando localmente.");
        }
    }

    window.addEventListener('online', toggleStatus);
    window.addEventListener('offline', toggleStatus);fetch
    toggleStatus(); // Comprobación inicial
}

// Utilitario de notificación flotante
function mostrarToast(mensaje) {
    const toast = document.getElementById('toast');
    toast.textContent = mensaje;
    toast.style.display = 'block';
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}
// =======================================================
// 🔌 FUNCIONES AUXILIARES PARA EL MODO LOCAL (FALLBACK)
// =======================================================

// 1. Dibuja la biblioteca usando solo el disco duro de la tablet
function cargarBibliotecaDesdeLocal() {
    // Leemos las jugadas locales que guardamos con nuestra clave especial
    const listadoJugadas = JSON.parse(localStorage.getItem('jugadas_locales_baloncesto')) || [];
    
    // En modo local, todas las jugadas se tratan como personales del entrenador
    const personales = listadoJugadas;

    // Pintamos la lista de jugadas personales
    listPersonal.innerHTML = "";
    if (personales.length === 0) {
        listPersonal.innerHTML = '<div style="color: #94a3b8; font-size: 0.8rem; padding: 10px;">Ninguna jugada local guardada.</div>';
    } else {
        personales.forEach(j => {
            const activeClass = (jugadaActivaId === j.id) ? 'active' : '';
            listPersonal.innerHTML += `
                <div class="play-item ${activeClass}" onclick="cargarJugada('${j.id}', false)">
                    <div>
                        <span>🏀 ${j.nombre}</span>
                        <div style="font-size: 0.75rem; color: #f59e0b; margin-top: 2px;">⚡ Guardado en Local</div>
                    </div>
                    <div class="play-item-actions">
                        <button class="action-icon" title="Borrar" onclick="borrarJugada(event, '${j.id}', false)">🗑️</button>
                    </div>
                </div>
            `;
        });
    }

    // El catálogo oficial de la escuela requiere internet, avisamos amigablemente
    listSchool.innerHTML = '<div style="color: #64748b; font-size: 0.8rem; padding: 10px;">⚠️ Conéctate a internet para ver el catálogo oficial de la escuela.</div>';
}

// 2. Guarda la jugada físicamente dentro de la memoria de la tablet
function guardarEnLocal(jugadaObj) {
    let jugadasLocales = JSON.parse(localStorage.getItem('jugadas_locales_baloncesto')) || [];
    
    // Si la jugada ya existía por ID, la actualizamos; si no, la añadimos al principio
    const index = jugadasLocales.findIndex(j => j.id === jugadaObj.id);
    if (index !== -1) {
        jugadasLocales[index] = jugadaObj;
    } else {
        jugadasLocales.unshift(jugadaObj);
    }
    
    // Guardamos la lista convertida en texto en la memoria del navegador
    localStorage.setItem('jugadas_locales_baloncesto', JSON.stringify(jugadasLocales));
    
    jugadaActivaId = jugadaObj.id;
    nombreJugadaActiva = jugadaObj.nombre;
    tieneCambiosSinGuardar = false;
    
    cargarBibliotecaDesdeLocal();
    actualizarUI();
    mostrarToast(`💾 Guardado local: "${jugadaObj.nombre}"`);
}

// =======================================================================
// 🚀 INSERCIÓN SEGURA: LÓGICA DE PASOS UNIFICADA
// =======================================================================

// Función para capturar las coordenadas de las fichas en el paso activo
function capturarEstadoFichas() {
    let estadoFichas = {};
    
    // Buscamos todas las fichas en la pantalla
    const fichasEnPantalla = document.querySelectorAll('.token');
    
    fichasEnPantalla.forEach(ficha => {
        // Guardamos las posiciones en % tal y como las maneja tu POSICIONES_INICIALES
        estadoFichas[ficha.id] = {
            x: parseFloat(ficha.style.left) || 0,
            y: parseFloat(ficha.style.top) || 0
        };
    });
    
    // Clonación profunda matemática para evitar hilos de referencia
    return JSON.parse(JSON.stringify(estadoFichas));
}

// Función para agregar un nuevo paso con el límite de 10
function agregarNuevoPaso() {
    // 🛑 REGLA DE NEGOCIO: Límite estricto de 10 pasos
    if (jugadaPasos.length >= 10) {
        alert("⚠️ ¡Atención Entrenador! El límite máximo para una jugada es de 10 pasos.");
        return;
    }
    
    // 1. Capturamos la disposición actual
    const nuevoFotograma = capturarEstadoFichas();
    
    // 2. Lo añadimos a tu lista oficial de pasos (jugadaPasos)
    jugadaPasos.push(nuevoFotograma);
    
    // 3. Movemos tu cursor activo (pasoActivoIndex) al nuevo paso recién creado
    pasoActivoIndex = jugadaPasos.length - 1;
    
    // 4. Actualizamos la pantalla de tu tablet
    actualizarUI(); 
    mostrarToast(`Paso ${jugadaPasos.length} creado.`);

    guardarEnLocalStorage();
}

// Función para eliminar el paso actual con confirmación segura
function eliminarPasoActual() {
    // 🛑 REGLA DE NEGOCIO: Mínimo 1 paso activo obligatorio
    if (jugadaPasos.length <= 1) {
        alert("No puedes eliminar este paso. La pizarra táctica debe tener al menos 1 paso activo.");
        return;
    }
    
    // 🛡️ EL GUARDAESPALDAS DE CONFIRMACIÓN
    const confirmar = confirm(`¿Seguro que quieres eliminar el "Paso ${pasoActivoIndex + 1}"?\n\nEsta acción no se puede deshacer.`);
    if (!confirmar) return; // Cancelación segura
    
    // 1. MUTACIÓN: Eliminamos el paso de tu lista oficial usando su índice
    jugadaPasos.splice(pasoActivoIndex, 1);
    
    // 2. REGLA DE NAVEGACIÓN: Si borramos el último, retrocedemos un paso
    if (pasoActivoIndex >= jugadaPasos.length) {
        pasoActivoIndex = jugadaPasos.length - 1;
    }
    
    // 3. Refrescamos la pantalla con las nuevas posiciones y botones reindexados
    actualizarUI();
    aplicarPosicionesPantalla(jugadaPasos[pasoActivoIndex]);
    mostrarToast("Paso eliminado con éxito.");

    guardarEnLocalStorage();
}

// =======================================================================
// 🔌 CONEXIÓN DE LOS NUEVOS BOTONES (EVENT LISTENERS)
// =======================================================================

// Conectamos los cables cuando la ventana termine de cargar
window.addEventListener('load', () => {
    // 🧠 DECISIÓN INTELIGENTE DE CARGA:
    // Intentamos buscar si el entrenador dejó una jugada a medias en su disco local
    const seHaRecuperadoJugada = cargarDesdeLocalStorage();
    
    if (seHaRecuperadoJugada) {
        // 🔖 NUEVO: Leemos el marcapáginas del disco. 
        // Si no existe nada guardado aún, por defecto empezamos en el paso 0.
        // Usamos parseInt() para convertir el texto "2" en el número real 2.
        const pasoGuardado = localStorage.getItem('pizarra_paso_activo_index');
        pasoActivoIndex = pasoGuardado ? parseInt(pasoGuardado) : 0;
        
        // Colocamos las fichas en su sitio correspondiente de ese paso recuperado
        aplicarPosicionesConAnimacion(jugadaPasos[pasoActivoIndex], 0);
        
        actualizarUI();
        mostrarToast("¡Jugada y paso actual recuperados con éxito! 🏀");
    } else {
        inicializarLienzoNuevo();
    }
    
    // El resto de tus inicializaciones siguen igual abajo:
    configurarArrastre();
    comprobarConectividad();
    
    // Conexiones de tus botones unificados
    if (btnPlayPause) btnPlayPause.addEventListener('click', alternarReproduccion);
    if (btnUndo) btnUndo.addEventListener('click', deshacerUltimoMovimiento);
    if (btnAddStep) btnAddStep.addEventListener('click', agregarNuevoPaso);
    if (btnDeleteStep) btnDeleteStep.addEventListener('click', eliminarPasoActual);
});

// =======================================================================
// ⚙️ MOTOR DE ANIMACIÓN MATEMÁTICO (VÍA JAVASCRIPT - OPCIÓN B)
// =======================================================================

// 1. Guardamos una variable global para controlar el metrónomo.
// Así podemos detener la animación si el entrenador cambia de paso a mitad de camino [Módulo 7].
let animacionIntervalo = null; 

/**
 * Desplaza suavemente todas las fichas desde sus posiciones actuales
 * hasta las posiciones del paso de destino.
 * @param {Object} posicionesDestino - Coordenadas X e Y finales de las 11 fichas [Módulo 6].
 * @param {number} duracion - Tiempo total del viaje en milisegundos (por defecto 500ms).
 */
function aplicarPosicionesConAnimacion(posicionesDestino, duracion = 500) {
    
    // 🛡️ REGLA DE SEGURIDAD: Si ya hay una animación corriendo, la paramos de inmediato
    // para evitar que dos temporizadores se peleen por mover al mismo jugador [Módulo 5].
    if (animacionIntervalo) {
        clearInterval(animacionIntervalo);
        animacionIntervalo = null;
    }

    // 2. CAPTURA DEL PUNTO DE PARTIDA (Punto A)
    // Guardamos la posición exacta en la que se encuentra físicamente cada ficha en la pantalla justo ahora.
    const posicionesOrigen = {};
    const todasLasFichas = document.querySelectorAll('.token');
    
    todasLasFichas.forEach(ficha => {
        posicionesOrigen[ficha.id] = {
            x: parseFloat(ficha.style.left) || 0,
            y: parseFloat(ficha.style.top) || 0
        };
    });

    // 3. CONFIGURACIÓN DEL VIAJE TEMPORAL
    const intervaloMs = 16; // ~60 actualizaciones por segundo (el estándar de fluidez FPS) [Plano de Arquitectura Lógica]
    let tiempoTranscurrido = 0;

    // 4. ENCIENDE EL METRÓNOMO (Arranca el bucle de tiempo) [Módulo 5]
    animacionIntervalo = setInterval(() => {
        tiempoTranscurrido += intervaloMs;
        
        // Calculamos qué fracción del viaje hemos completado (un número entre 0.0 y 1.0)
        let progreso = tiempoTranscurrido / duracion;

        // 🛑 EL FRENO DE MANO: Si el tiempo se agota, clavamos el progreso en 1.0 (100%)
        // y apagamos el temporizador de la memoria de la tablet [Módulo 5].
        if (progreso >= 1) {
            progreso = 1;
            clearInterval(animacionIntervalo);
            animacionIntervalo = null;
        }

        // 5. MOVIMIENTO QUIRÚRGICO DE CADA FICHA
        todasLasFichas.forEach(ficha => {
            const id = ficha.id;
            const origen = posicionesOrigen[id];
            const destino = posicionesDestino[id];

            // Si por alguna razón la ficha no tiene coordenadas de destino, no la tocamos
            if (!origen || !destino) return;

            // 📐 LA FÓRMULA MAESTRA DE INTERPOLACIÓN (LERP):
            // Posicion_Actual = Origen + (Distancia * Progreso)
            // Esto asegura que la ficha se desplace en una línea recta perfecta.
            const actualX = origen.x + (destino.x - origen.x) * progreso;
            const actualY = origen.y + (destino.y - origen.y) * progreso;

            // Pintamos la nueva coordenada en la pantalla del dispositivo
            ficha.style.left = `${actualX}%`;
            ficha.style.top = `${actualY}%`;
        });

    }, intervaloMs); // Se repite cada 16 milisegundos [Módulo 5]
}

// =======================================================================
// ⏸️ REPRODUCTOR TÁCTICO AUTOMÁTICO (PLAY / PAUSA)
// =======================================================================

/**
 * Función principal que se activa al pulsar el botón "Play/Pausa".
 * Decide si debe arrancar la película táctica o congelarla [Source 10, 16].
 */
function alternarReproduccion() {
    if (estaReproduciendo) {
        // CONDICIONAL SI: Si ya está encendido, el entrenador quiere PAUSAR [Source 10]
        detenerReproduccion();
        if (btnPlayPause) btnPlayPause.innerHTML = "▶ Reproducir";
        mostrarToast("Reproducción pausada.");
    } else {
        // CONDICIONAL SINO: Si está apagado, el entrenador quiere REPRODUCIR [Source 10]
        estaReproduciendo = true;
        if (btnPlayPause) btnPlayPause.innerHTML = "⏸ Pausa";
        mostrarToast("Iniciando jugada táctica...");
        
        // Arrancamos el ciclo de avance automático
        iniciarCicloReproduccion();
    }
}

/**
 * Detiene físicamente el reproductor y limpia la memoria de la tablet.
 */
function detenerReproduccion() {
    estaReproduciendo = false;
    if (reproductorIntervalo) {
        clearInterval(reproductorIntervalo); // Apagamos el segundero [Plano de Arquitectura Lógica]
        reproductorIntervalo = null;
    }
}

/**
 * El metrónomo maestro de la jugada. Pasa los pasos de forma secuencial.
 */
function iniciarCicloReproduccion() {
    // ⏲️ Sincronización de Tiempos:
    // El metrónomo sonará cada 2.5 segundos (2500 milisegundos).
    // Esto da 500ms para que las fichas se deslicen suavemente y 2 segundos enteros
    // para que los alumnos observen la táctica antes del siguiente movimiento [Plano de Arquitectura Lógica].
    reproductorIntervalo = setInterval(() => {
        
        // 🛑 REGLA DE NEGOCIO: ¿Hemos llegado al último paso creado de la jugada? [Source 10, 14]
        if (pasoActivoIndex >= jugadaPasos.length - 1) {
            
            // Fin de trayecto: detenemos el reproductor automático
            detenerReproduccion();
            if (btnPlayPause) btnPlayPause.innerHTML = "▶ Reproducir";
            
            // 🔄 OPCIONAL REINICIAR: Devolvemos la jugada al Paso 1 para que pueda volver a verse
            pasoActivoIndex = 0;
            aplicarPosicionesConAnimacion(jugadaPasos[pasoActivoIndex], 500);
            actualizarUI();
            mostrarToast("Jugada completada. Lista para repetir.");
            
        } else {
            // SINO: Avanzamos de forma segura un paso hacia adelante en la línea de tiempo [Source 10]
            pasoActivoIndex++;
            
            // Desplazamos las fichas de forma animada por el parqué clásico
            aplicarPosicionesConAnimacion(jugadaPasos[pasoActivoIndex], 500);
            
            // Actualizamos los textos e indicadores inferiores
            actualizarUI();
        }
        
    }, 2500); // Frecuencia del metrónomo: 2.5 segundos [Plano de Arquitectura Lógica]
}

// =======================================================================
// ↩️ SISTEMA DE DESHACER (UNDO) CON PILA LIFO
// =======================================================================

/**
 * Captura las posiciones actuales de las fichas, hace una "Foto Polaroid"
 * (clonación por valor) y las apila en el historial [Source 15, 45, 86].
 */
function guardarEstadoEnHistorial() {
    // 📸 Sacamos la foto inmutable rompiendo la referencia de memoria [Source 45]
    const fotoActual = capturarEstadoFichas();
    
    // 📥 Hacemos un PUSH para colocar la foto arriba de nuestra pila [Source 15, 86]
    historialMovimientos.push(fotoActual);
}

/**
 * Desapila el último estado guardado y devuelve las fichas a esa posición
 * de manera suave y sincronizada [Source 85, 86, 87].
 */
function deshacerUltimoMovimiento() {
    // 🛡️ ESCUDO DE CONTROL: Si la pila está vacía, no hay nada que deshacer [Source 10]
    if (historialMovimientos.length === 0) {
        mostrarToast("No hay movimientos que deshacer.");
        return;
    }
    
    // 1. DESAPILAR (POP): Sacamos el plato que está arriba del todo de la pila [Source 87]
    const estadoAnterior = historialMovimientos.pop();
    
    // 2. ACTUALIZACIÓN: Sobrescribimos el paso activo en memoria con la foto recuperada [Source 2]
    // Usamos clonación profunda para que la pizarra siga libre de hilos de referencia [Source 45]
    jugadaPasos[pasoActivoIndex] = JSON.parse(JSON.stringify(estadoAnterior));
    
    // El lienzo tiene cambios sin guardar que debemos recordar
    tieneCambiosSinGuardar = true;
    
    // 3. REDIBUJAR: Deslizamos suavemente las fichas hacia atrás en el parqué (en 300ms)
    aplicarPosicionesConAnimacion(estadoAnterior, 300);
    
    // 4. Actualizamos la pantalla de tu tablet
    actualizarUI();
    mostrarToast("Movimiento deshecho.");
}

// =======================================================================
// 💾 SISTEMA DE PERSISTENCIA LOCAL (LOCALSTORAGE)
// =======================================================================

// La "etiqueta" única que usará nuestra app en el disco de la tablet
const CLAVE_LOCAL_STORAGE = 'pizarra_tactica_jugada_activa';

/**
 * Guarda automáticamente la secuencia entera de pasos en el disco local.
 * Se ejecuta de forma silenciosa cada vez que hay un cambio táctico.
 */
function guardarEnLocalStorage() {
    try {
        const jugadaEnTexto = JSON.stringify(jugadaPasos);
        localStorage.setItem(CLAVE_LOCAL_STORAGE, jugadaEnTexto);
        
        // 🔖 NUEVO: Guardamos también el marcapáginas (el paso en el que estamos parados)
        localStorage.setItem('pizarra_paso_activo_index', pasoActivoIndex);
        
    } catch (error) {
        console.error("Error al guardar en el disco:", error);
    }
}

/**
 * Intenta recuperar la jugada anterior guardada en el disco local.
 * Devuelve 'true' si recuperó datos con éxito, o 'false' si el cuaderno estaba en blanco.
 */
function cargarDesdeLocalStorage() {
    try {
        // 1. Lectura: Buscamos si existe la etiqueta en el disco
        const textoRecuperado = localStorage.getItem(CLAVE_LOCAL_STORAGE);
        
        if (textoRecuperado) {
            // 2. Deserialización: Convertimos el texto de vuelta al arreglo de pasos interactivos
            jugadaPasos = JSON.parse(textoRecuperado);
            return true;
        }
    } catch (error) {
        console.error("Error al leer desde el disco de la tablet:", error);
    }
    return false; // No había ninguna jugada guardada
}

// =======================================================================
// 📄 SISTEMA DE REINICIO DE ESTADO: NUEVA JUGADA
// =======================================================================

/**
 * Borra por completo el parqué clásico, vacía la memoria y destruye el historial.
 * Devuelve la app al estado inicial de fábrica de forma segura.
 */
function iniciarNuevaJugada() {
    // 🛡️ ESCUDO DE SEGURIDAD: Preguntamos al entrenador antes de borrar nada
    const confirmarBorrado = confirm("⚠️ ¿Estás seguro de que quieres borrar TODA la pizarra para empezar una nueva jugada?\nEsto eliminará todos los pasos de la tablet y no se puede deshacer.");
    
    if (!confirmarBorrado) {
        return; // El entrenador pulsó "Cancelar": salimos de la función sin tocar nada
    }
    
    // 1. DETENER EL PLAY AUTOMÁTICO (Por seguridad, si estaba corriendo)
    detenerReproduccion();
    if (btnPlayPause) btnPlayPause.innerHTML = "▶ Reproducir";
    
    // 2. LIMPIEZA DE MEMORIA RAM (De vuelta a los valores originales de inicio)
    pasoActivoIndex = 0;
    historialMovimientos = []; // Vaciamos la pila de Deshacer
    
    // Volvemos a crear un arreglo con un único paso, usando clonación profunda
    // para que las posiciones por defecto no se queden amarradas en memoria
    jugadaPasos = [JSON.parse(JSON.stringify(POSICIONES_INICIALES))];
    
    tieneCambiosSinGuardar = false;
    
    // 3. LIMPIEZA DE MEMORIA PERSISTENTE (Trastocar el disco de la tablet)
    localStorage.removeItem(CLAVE_LOCAL_STORAGE);
    localStorage.removeItem('pizarra_paso_activo_index');
    
    // 4. REDIBUJAR LA PANTALLA
    // Mandamos los jugadores a su sitio con una elegante animación de 400 milisegundos
    aplicarPosicionesConAnimacion(POSICIONES_INICIALES, 400);
    
    // Actualizamos las etiquetas y botones del carrusel inferior
    actualizarUI();
    
    mostrarToast("¡Pizarra reiniciada! Diseña una nueva estrategia. 🏀");
}

// =======================================================================
// ☁️ SISTEMA CLIENTE-SERVIDOR: LA BIBLIOTECA TÁCTICA
// =======================================================================

/**
 * 1. EL MENSAJERO: Va a Supabase, busca las jugadas y espera la respuesta [1].
 */
async function abrirBiblioteca() {
    // Mostramos la ventana de madera en la pantalla
    document.getElementById('modal-biblioteca').style.display = 'block';
    
    try { // 🛡️ Nuestro seguro anti-caídas de WiFi [6]
        // 🚦 Mandamos al mensajero y pausamos el tiempo (await) [1, 3]
        const respuesta = await fetch(`${SUPABASE_URL}/rest/v1/jugadas`, { // <─── ¡Concatenamos la ruta oficial completa!
            method: 'GET',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });

        if (!respuesta.ok) throw new Error("Error en la aduana de Supabase");

        // Convertimos la caja fuerte en un Array de objetos interactivos [4]
        const listaJugadas = await respuesta.json();
        
        // Le pasamos el arreglo fresco a nuestro ayudante para que pinte [8]
        pintarTablonDeJugadas(listaJugadas);
        
    } catch (error) {
        console.error(error);
        alert("Sin conexión al pabellón. Revisa tu internet.");
    }
}

/**
 * 2. EL AYUDANTE (BUCLE): Limpia el corcho y cuelga los folios nuevos [11, 12].
 */
function pintarTablonDeJugadas(jugadas) {
    const columnaOficiales = document.getElementById('lista-oficiales');
    const columnaPersonales = document.getElementById('lista-personales');

    // 🧹 PASO CLAVE: Vaciamos el tablón visual para evitar duplicados infinitos
    columnaOficiales.innerHTML = '';
    columnaPersonales.innerHTML = '';

    // 🔄 Iteramos la caja de jugadas una por una [12]
    jugadas.forEach(jugada => {
        
        // Fabricamos la tarjeta visual usando "Plantillas Literales" (Backticks)
        // El operador ternario (?) decide si pinta el botón de borrar [13, 14]
        const tarjetaHTML = `
            <div style="border: 1px solid #ccc; padding: 10px; margin-bottom: 10px; border-radius: 5px;">
                <h4 style="margin: 0 0 10px 0;">🏀 ${jugada.nombre}</h4>
                <button onclick="cargarJugadaEnCancha('${jugada.id}')">👁️ Abrir</button>
                
                ${jugada.es_oficial === false ? 
                    `<button style="background: red; color: white;" onclick="borrarJugada('${jugada.id}')">🗑️ Borrar</button>` 
                    : ''}
            </div>
        `;

        // 🗂️ A la aduana: ¿Es de la escuela o es personal?
        if (jugada.es_oficial === true) {
            columnaOficiales.innerHTML += tarjetaHTML;
        } else if (jugada.creador_email === MI_EMAIL) {
            columnaPersonales.innerHTML += tarjetaHTML;
        }
    });

    // Estado vacío si no hay jugadas [15]
    if(columnaOficiales.innerHTML === '') columnaOficiales.innerHTML = '<i>No hay jugadas oficiales.</i>';
    if(columnaPersonales.innerHTML === '') columnaPersonales.innerHTML = '<i>Empieza a crear tus propias estrategias.</i>';
}

function cerrarBiblioteca() {
    document.getElementById('modal-biblioteca').style.display = 'none';
}

// ⚠️ Mocks vacíos para que los botones no den error al pulsarlos hoy
function cargarJugadaEnCancha(id) { alert("¡Pronto cargaremos la jugada " + id + " en el parqué!"); }
function borrarJugada(id) { alert("¡Pronto borraremos la jugada " + id + " de la nube!"); }

// =========================================================================
// 🧠 CEREBRO DEL MODO PRESENTADOR (VERSIÓN ACOPLADA AL MOTOR ORIGINAL)
// =========================================================================

let esModoPresentador = false; // 💡 Interruptor del proyector táctico

// 1. FUNCIÓN DE CONMUTACIÓN: Enciende y apaga la vista de gala
function alternarModoPresentador() {
    esModoPresentador = !esModoPresentador; 

    const cuerpoPantalla = document.body;

    if (esModoPresentador) {
        // 🚪 ENTRADA AL MODO PRESENTACIÓN
        cuerpoPantalla.classList.add("modo-presentador-activo"); // CSS limpia la pantalla por completo
        bloquearArrastreFichas(true);                           // Atornillamos las fichas a la cancha
        
        // Forzamos el reinicio al Paso 1 de forma física
        if (jugadaPasos.length > 0) {
            pasoActivoIndex = 0;
            aplicarPosicionesPantalla(jugadaPasos[0]); // El Sargento coloca las fichas en el Paso 1
            actualizarUI();                            // Actualiza el marcador original superior
        }
        actualizarMarcadorPantalla();                  // Sincroniza nuestro marcador flotante
    } else {
        // 🚪 SALIDA DEL MODO PRESENTACIÓN
        cuerpoPantalla.classList.remove("modo-presentador-activo"); // CSS devuelve las herramientas de diseño
        bloquearArrastreFichas(false);                              // Desbloqueamos las fichas para poder diseñar
        actualizarUI();                                             // Refrescamos todo para normalizar
    }
}

// 2. FUNCIÓN AUXILIAR: Evita arrastres accidentales con la palma de la mano
function bloquearArrastreFichas(bloquear) {
    const fichas = document.querySelectorAll(".ficha, .ball"); 
    fichas.forEach(ficha => {
        ficha.setAttribute("draggable", bloquear ? "false" : "true");
    });
}

// 3. FUNCIÓN AUXILIAR: Actualiza el marcador flotante y deshabilita botones en los límites
function actualizarMarcadorPantalla() {
    const marcador = document.getElementById("marcador-pasos");
    const totalPasos = jugadaPasos.length;
    
    // Escribimos en el cartel "Paso X de Y"
    marcador.textContent = `Paso ${pasoActivoIndex + 1} de ${totalPasos}`;

    // 🛡️ CONTROL DE LÍMITES TÁCTILES: Apagamos los botones en los extremos
    const btnAnterior = document.getElementById("btn-presentador-anterior");
    const btnSiguiente = document.getElementById("btn-presentador-siguiente");

    btnAnterior.disabled = (pasoActivoIndex === 0);
    btnSiguiente.disabled = (pasoActivoIndex === totalPasos - 1);
}

// 4. CONTROLADORES DE NAVEGACIÓN: Delegamos en tu motor original "cambiarPaso"
function irAlPasoSiguiente() {
    const totalPasos = jugadaPasos.length;
    
    // Escudo de seguridad: solo avanzamos si hay camino por delante
    if (pasoActivoIndex < totalPasos - 1) {
        cambiarPaso(1);               // ¡Llamamos a tu Director de Orquesta original!
        actualizarMarcadorPantalla();  // Sincronizamos nuestro marcador flotante
    }
}

function irAlPasoAnterior() {
    // Escudo de seguridad: solo retrocedemos si no estamos en el inicio
    if (pasoActivoIndex > 0) {
        cambiarPaso(-1);              // ¡Llamamos a tu Director de Orquesta original!
        actualizarMarcadorPantalla();  // Sincronizamos nuestro marcador flotante
    }
}

// =========================================================================
// 🔌 CONEXIONES FÍSICAS (DOMContentLoaded)
// =========================================================================
document.addEventListener("DOMContentLoaded", () => {
    // Enlace del botón de entrada en tu barra superior
    const btnEntrar = document.getElementById("btn-entrar-presentador");
    if (btnEntrar) {
        btnEntrar.addEventListener("click", alternarModoPresentador);
    }

    // Enlace de los botones flotantes inferiores del presentador
    document.getElementById("btn-presentador-salir").addEventListener("click", alternarModoPresentador);
    document.getElementById("btn-presentador-siguiente").addEventListener("click", irAlPasoSiguiente);
    document.getElementById("btn-presentador-anterior").addEventListener("click", irAlPasoAnterior);
    
    // Atajos de teclado físicos para el proyector del pabellón
    document.addEventListener("keydown", (evento) => {
        if (!esModoPresentador) return; // Si el modo está apagado, ignoramos el teclado
        
        if (evento.key === "Escape") alternarModoPresentador();
        if (evento.key === "ArrowRight") irAlPasoSiguiente();
        if (evento.key === "ArrowLeft") irAlPasoAnterior();
    });
});

// =========================================================================
// 🔑 LÓGICA DE AUTENTICACIÓN E INICIO DE SESIÓN (app.js)
// =========================================================================

async function procesarLogin(event) {
    // 1. Freno de mano: Evita que el navegador recargue la página al pulsar "Entrar"
    event.preventDefault();

    // 2. Localización de los elementos del DOM (Pantalla)
    const inputEmail = document.getElementById('login-email');
    const inputPassword = document.getElementById('login-password');
    const errorMsg = document.getElementById('login-error-msg');
    const overlay = document.getElementById('login-overlay');

    // 3. Extracción y limpieza del texto escrito por el entrenador
    const email = inputEmail ? inputEmail.value.trim() : '';
    const password = inputPassword ? inputPassword.value : '';

    // Limpiamos mensajes de error antiguos de la pantalla
    if (errorMsg) {
        errorMsg.style.display = 'none';
        errorMsg.textContent = '';
    }

    // 4. Validación de campos vacíos antes de molestar al servidor
    if (!email || !password) {
        if (errorMsg) {
            errorMsg.textContent = "⚠️ Por favor, introduce tu correo y contraseña.";
            errorMsg.style.display = 'block';
        }
        return; // Detenemos la ejecución si falta algún dato
    }

    try {
        // Aviso visual temporal mientras viajan los datos por la red
        if (typeof mostrarToast === 'function') {
            mostrarToast("⏳ Validando credenciales con el club...");
        }

        // 5. Petición asíncrona a la base de datos de Supabase Auth
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

        // Si la nube responde con rechazo, saltamos inmediatamente al bloque catch
        if (error) throw error;

        // 6. ¡ACCESO CONCEDIDO!
        // Guardamos el correo en nuestra variable global de sesión viva
        usuarioEmailActual = (data && data.user) ? data.user.email : email;

        actualizarMenuSegunRol();

        // Ocultamos la tarjeta modal flotante liberando el lienzo de la cancha
        if (overlay) {
            overlay.style.display = 'none';
        }

        // Damos la bienvenida personalizada mediante una alerta flotante
        if (typeof mostrarToast === 'function') {
            mostrarToast(`👋 ¡Bienvenido/a, ${usuarioEmailActual}!`);
        }

        // 7. Redibujamos la biblioteca lateral con las jugadas exclusivas del usuario
        if (typeof cargarBiblioteca === 'function') {
            await cargarBiblioteca();
        }

    } catch (error) {
        console.error("❌ Error en el inicio de sesión:", error.message);
        
        // 8. Visualización de mensaje de error en la tarjeta modal
        if (errorMsg) {
            errorMsg.textContent = "❌ Correo o contraseña incorrectos.";
            errorMsg.style.display = 'block';
        }
    }
}

// =========================================================================
// 🔒 FUNCIÓN DE CONTROL DE VISIBILIDAD DE MENÚ SEGÚN EL ROL DE USUARIO
// =========================================================================
function actualizarMenuSegunRol() {
    // Localizamos en la pantalla el botón con el ID exacto de tu index.html
    const btnAdmin = document.getElementById('btn-role-admin'); 

    // Si el botón no existe en el DOM, detenemos la función de forma segura
    if (!btnAdmin) return;

    // Evaluamos si el correo activo pertenece al Director Deportivo
    if (typeof usuarioEmailActual !== 'undefined' && usuarioEmailActual === 'admin@pizarra.com') {
        btnAdmin.style.display = 'flex'; // Hacemos visible el botón
        rolActual = 'admin';             // Asignamos rol de Administrador
    } else {
        btnAdmin.style.display = 'none'; // Ocultamos el botón por completo
        rolActual = 'entrenador';        // Asignamos rol de Entrenador
    }
}

// =========================================================================
// 🚪 FUNCIÓN DE CIERRE DE SESIÓN Y LIMPIEZA DE MEMORIA (app.js)
// =========================================================================
async function cerrarSesion() {
    try {
        // 1. Notificamos al servidor de Supabase que anulamos el permiso activo
        if (typeof supabaseClient !== 'undefined' && supabaseClient.auth) {
            await supabaseClient.auth.signOut();
        }

        // 2. Destrucción de Variables de Memoria Globales (Reset)
        usuarioEmailActual = "";
        rolActual = "entrenador";

        // 3. Reevaluamos el menú para ocultar el botón de Administrador
        if (typeof actualizarMenuSegunRol === 'function') {
            actualizarMenuSegunRol();
        }

        // 4. Limpieza visual de la columna "Mis Jugadas"
        const listPersonal = document.getElementById('list-personal');
        if (listPersonal) {
            listPersonal.innerHTML = '<div style="color: #64748b; font-size: 0.8rem; padding: 5px;">Inicia sesión para ver tus jugadas.</div>';
        }

        // 5. Limpiamos los campos de texto del formulario flotante
        const inputEmail = document.getElementById('login-email');
        const inputPassword = document.getElementById('login-password');
        if (inputEmail) inputEmail.value = '';
        if (inputPassword) inputPassword.value = '';

        // 6. Volvemos a desplegar la tarjeta modal flotante de inicio de sesión
        const overlay = document.getElementById('login-overlay');
        if (overlay) {
            overlay.style.display = 'flex';
        }

        // 7. Notificación visual de confirmación
        if (typeof mostrarToast === 'function') {
            mostrarToast("👋 Sesión cerrada correctamente. ¡Hasta pronto!");
        }

    } catch (error) {
        console.error("❌ Error al cerrar sesión:", error.message);
    }
}