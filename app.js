// ==========================================
// ☁️ CONFIGURACIÓN Y CONEXIÓN CON SUPABASE
// ==========================================
const SUPABASE_URL = "https://hlrlyyvddvtbvmzariuf.supabase.co"; 
const SUPABASE_ANON_KEY = "sb_publishable_X-hpA6s1Zeo7aLpT608fIQ_ig_qB0Ie";

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

// =======================================================================
// 🧠 BLOQUE 1: VARIABLES DE ESTADO GLOBAL (NUESTRO ARCHIVADOR)
// =======================================================================

// El "Playbook" es la tira de película que almacena todos los pasos de la jugada
let playbook = []; 

// El "currentStepIndex" es el cursor que nos dice qué paso estamos viendo ahora mismo.
// Recuerda: en programación empezamos a contar siempre desde el número 0 (Paso 1 = Índice 0) [Source 273].
let currentStepIndex = 0; 

// Inicializar Aplicación al cargar la ventana
window.addEventListener('load', () => {
    inicializarLienzoNuevo();
    cargarBiblioteca();
    configurarArrastre();
    comprobarConectividad();
});

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
    let isDragging = false;
    let activeToken = null;

    function startDrag(e) {
        const token = e.target.closest('.token');
        if (!token || (esJugadaOficialActiva && rolActual === 'entrenador')) return; // Bloqueo si es oficial solo lectura

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
        }
        isDragging = false;
        activeToken = null;
    }

    court.addEventListener('mousedown', startDrag);
    window.addEventListener('mousemove', drag);
    window.addEventListener('mouseup', stopDrag);

    court.addEventListener('touchstart', startDrag, { passive: false });
    window.addEventListener('touchmove', drag, { passive: false });
    window.addEventListener('touchend', stopDrag);
}

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
    aplicarPosicionesPantalla(jugadaPasos[pasoActivoIndex]);
    actualizarUI();
}

function aplicarAnimacionTemporal() {
    tokens.forEach(token => token.classList.add('animate-transition'));
    setTimeout(() => {
        tokens.forEach(token => token.classList.remove('animate-transition'));
    }, 600);
}

// 7. ROLES Y AUTORIZACIÓN
function cambiarRol(rol) {
    rolActual = rol;
    document.getElementById('btn-role-coach').classList.toggle('active', rol === 'entrenador');
    document.getElementById('btn-role-admin').classList.toggle('active', rol === 'admin');
    
    actualizarUI();
    cargarBiblioteca(); // Recarga la biblioteca para mostrar/ocultar botones de borrar
    mostrarToast(`Cambiado al modo: ${rol === 'admin' ? 'Administrador de la Escuela' : 'Entrenador'}`);
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
function duplicarJugadaOficial() {
    if (!esJugadaOficialActiva) return;

    const confirmar = confirm(`¿Quieres hacer una copia de "${nombreJugadaActiva}" en tus jugadas personales para poder editarla?`);
    if (!confirmar) return;

    const jugadaClonada = {
        id: Date.now().toString(),
        nombre: `${nombreJugadaActiva} (Copia)`,
        pasos: JSON.parse(JSON.stringify(jugadaPasos))
    };

    let listadoPersonales = JSON.parse(localStorage.getItem('jugadas_personales_entrenador')) || [];
    listadoPersonales.push(jugadaClonada);
    localStorage.setItem('jugadas_personales_entrenador', JSON.stringify(listadoPersonales));

    cargarBiblioteca();
    cargarJugada(jugadaClonada.id, false);
    mostrarToast(`📋 Copia creada. ¡Ya puedes editarla libremente!`);
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
    try {
        // Intentamos ir por la vía rápida y oficial (Nube)
        const { data: listadoJugadas, error } = await supabaseClient
            .from('jugadas')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Si funciona, desactivamos el modo de emergencia por si estaba encendido
        modoLocalDeEmergencia = false;

        const personales = listadoJugadas.filter(j => j.es_oficial === false);
        const oficiales = listadoJugadas.filter(j => j.es_oficial === true);

        // Pintar Personales (Nube)
        listPersonal.innerHTML = "";
        if (personales.length === 0) {
            listPersonal.innerHTML = '<div style="color: #64748b; font-size: 0.8rem; padding: 5px;">Ninguna jugada en la nube.</div>';
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

        // Pintar Oficiales (Nube)
        listSchool.innerHTML = "";
        if (oficiales.length === 0) {
            listSchool.innerHTML = '<div style="color: #64748b; font-size: 0.8rem; padding: 5px;">Ninguna jugada oficial.</div>';
        } else {
            oficiales.forEach(j => {
                const activeClass = (jugadaActivaId === j.id) ? 'active' : '';
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
        // Cargamos los datos guardados en el dispositivo
        cargarBibliotecaDesdeLocal();
    }
}

// 14. COMPORTAMIENTO DINÁMICO DE INTERFAZ (UI)
function actualizarUI() {
    playTitleDisplay.textContent = `${nombreJugadaActiva} ${tieneCambiosSinGuardar ? '*' : ''}`;
    
    btnPrev.disabled = (pasoActivoIndex === 0);
    btnNext.disabled = (pasoActivoIndex === jugadaPasos.length - 1);
    stepIndicator.textContent = `Paso: ${pasoActivoIndex + 1} / ${jugadaPasos.length}`;

    if (esJugadaOficialActiva && rolActual === 'entrenador') {
        btnDuplicate.style.display = 'block';
        document.querySelector('.btn-action.primary').disabled = true; // Desactiva guardar para entrenador
    } else {
        btnDuplicate.style.display = 'none';
        document.querySelector('.btn-action.primary').disabled = false;
    }

    const isReadOnly = (esJugadaOficialActiva && rolActual === 'entrenador');
    tokens.forEach(token => {
        token.style.cursor = isReadOnly ? 'not-allowed' : 'grab';
    });
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
    window.addEventListener('offline', toggleStatus);
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
// 🛡️ BLOQUE 2: LA FUNCIÓN DE CAPTURA CON CLONACIÓN PROFUNDA (DEEP COPY)
// =======================================================================

function capturarEstadoFichas() {
    let estadoFichas = [];
    
    // Buscamos todas las fichas tácticas reales que hay en el parqué de la pantalla
    const fichasEnPantalla = document.querySelectorAll('.token');
    
    fichasEnPantalla.forEach(ficha => {
        // Leemos las coordenadas actuales X e Y guardadas en la pantalla
        estadoFichas.push({
            id: ficha.id,                                // Ej: "attack1", "ball"
            x: parseFloat(ficha.style.left) || 0,        // Posición horizontal en %
            y: parseFloat(ficha.style.top) || 0          // Posición vertical en %
        });
    });
    
    // 🌟 EL TRUCO DEL CLONADOR PERFECTO:
    // Convertimos la lista de coordenadas a texto plano (stringify) y la reconstruimos (parse).
    // Así rompemos cualquier hilo invisible de referencia en la memoria [Source 24, 60, 66].
    return JSON.parse(JSON.stringify(estadoFichas));
}


// =======================================================================
// 🚀 BLOQUE 3: CREAR UN NUEVO PASO DE LA JUGADA (HACIA ADELANTE)
// =======================================================================

function agregarNuevoPaso() {
    // 🛑 REGLA DE NEGOCIO: Evitar que la memoria se sature (Límite de 10 pasos)
    if (playbook.length >= 10) {
        alert("¡Atención Entrenador! El límite máximo para una jugada es de 10 pasos.");
        return; // Detiene la función de inmediato y no añade nada
    }
    
    // 1. Capturamos la "fotografía" independiente de cómo están colocados los jugadores ahora mismo
    const nuevoFotograma = capturarEstadoFichas();
    
    // 2. Metemos la foto en el archivador (al final de nuestra lista) [Source 271]
    playbook.push(nuevoFotograma);
    
    // 3. Movemos nuestro cursor activo al nuevo paso que acabamos de crear
    currentStepIndex = playbook.length - 1;
    
    // 4. Actualizamos la interfaz (dibujar botones abajo y refrescar pantalla)
    actualizarBarraPasosUI();
    console.log(`Paso ${playbook.length} creado con éxito y clonado por valor.`);
}


// =======================================================================
// 🗑️ BLOQUE 4: ELIMINACIÓN DE PASOS CON CONFIRMACIÓN SEGURA
// =======================================================================

function eliminarPasoActual() {
    // 🛑 REGLA DE NEGOCIO: La jugada debe tener siempre al menos un paso
    if (playbook.length <= 1) {
        alert("No puedes eliminar este paso. La pizarra táctica debe tener al menos 1 paso activo.");
        return; // Detiene la ejecución
    }
    
    // 🛡️ EL GUARDAESPALDAS DE SEGURIDAD (CONFIRMACIÓN DE USUARIO):
    // La función native 'confirm' detendrá la app y preguntará al entrenador [Source 213].
    const entrenadorConfirma = confirm(
        `¿Seguro que quieres eliminar el "Paso ${currentStepIndex + 1}"?\n\nEsta acción no se puede deshacer.`
    );
    
    // Si el entrenador pulsa "Cancelar" (devuelve false), salimos de la función y no tocamos nada
    if (!entrenadorConfirma) {
        console.log("Eliminación cancelada por el entrenador.");
        return; 
    }
    
    // Si confirma (devuelve true), procedemos con la trituración quirúrgica de datos:
    // 1. Eliminamos el paso del arreglo global usando su índice activo [Source 18]
    playbook.splice(currentStepIndex, 1);
    
    // 2. REGLA DE NAVEGACIÓN: Si borramos el último paso, retrocedemos el cursor al nuevo último paso
    if (currentStepIndex >= playbook.length) {
        currentStepIndex = playbook.length - 1;
    }
    
    // 3. REINDEXACIÓN Y LIMPIEZA: Redibujamos la barra inferior con los nombres corregidos
    actualizarBarraPasosUI();
    
    // 4. Cargamos en el parqué las posiciones del paso que ha quedado activo
    cargarPasoEnPantalla(currentStepIndex);
    
    console.log("Paso eliminado. El archivador global ha sido reindexado con éxito.");
}