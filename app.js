// ==========================================
// ☁️ CONFIGURACIÓN Y CONEXIÓN CON SUPABASE
// ==========================================
const SUPABASE_URL = "https://hlrlyyvddvtbvmzariuf.supabase.co"; 
const SUPABASE_ANON_KEY = "sb_publishable_X-hpA6s1Zeo7aLpT608fIQ_ig_qB0Ie";

// Creamos el intérprete oficial que hablará con tu base de datos
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

// 8. GUARDADO DE JUGADAS (AHORA EN SUPABASE COOPERATIVO)
async function guardarJugada() {
    // 1. Preguntamos el nombre de la jugada
    const nombreSugerido = (nombreJugadaActiva === "Lienzo Nuevo") ? "" : nombreJugadaActiva;
    const nombreIntroducido = prompt("Escribe el nombre de la jugada táctica:", nombreSugerido);
    if (nombreIntroducido === null) return; // Cancelar silencioso
    
    const nombreLimpio = nombreIntroducido.trim();
    if (nombreLimpio === "") {
        alert("❌ ¡Error! No puedes guardar una jugada sin ponerle un nombre.");
        return;
    }

    // 2. Preguntamos el correo del creador para la firma de autor
    const correoSugerido = localStorage.getItem('ultimo_entrenador_email') || "";
    const correoIntroducido = prompt("Por favor, escribe tu correo de entrenador para firmar tu trabajo:", correoSugerido);
    if (correoIntroducido === null) return; // Cancelar silencioso

    const correoLimpio = correoIntroducido.trim();
    if (correoLimpio === "" || !correoLimpio.includes('@')) {
        alert("❌ ¡Error! Debes introducir un correo electrónico válido para no perder tu trabajo.");
        return;
    }

    // Recordamos el correo en la tablet para que no tenga que escribirlo cada vez
    localStorage.setItem('ultimo_entrenador_email', correoLimpio);

    // 3. Preparamos la jugada en un paquete de datos (Objeto)
    const nuevaJugadaObjeto = {
        nombre: nombreLimpio,
        pasos: jugadaPasos, // Lista de pasos que se guardará en formato JSONB
        creador_email: correoLimpio,
        es_oficial: (rolActual === 'admin') // Si es admin, es oficial de la escuela
    };

    mostrarToast("☁️ Guardando en la nube de Supabase...");

    // 4. Intentamos el envío asíncrono con red de seguridad (Try/Catch)
    try {
        let response;
        
        if (jugadaActivaId) {
            // Si ya tiene ID, actualizamos la jugada existente en la nube
            response = await supabase
                .from('jugadas')
                .update(nuevaJugadaObjeto)
                .eq('id', jugadaActivaId);
        } else {
            // Si es nueva, la insertamos y Supabase nos devolverá el ID único generado
            response = await supabase
                .from('jugadas')
                .insert([nuevaJugadaObjeto])
                .select();
                
            if (response.data && response.data[0]) {
                jugadaActivaId = response.data[0].id; // Asignamos el UUID real
            }
        }

        if (response.error) throw response.error;

        nombreJugadaActiva = nombreLimpio;
        tieneCambiosSinGuardar = false;

        // Recargamos la biblioteca para ver la jugada reflejada
        await cargarBiblioteca();
        actualizarUI();
        mostrarToast(`💾 ¡Éxito! "${nombreLimpio}" blindada en la nube.`);

    } catch (error) {
        console.error("Error al conectar con Supabase:", error);
        mostrarToast("❌ Error de conexión. No se pudo guardar en la nube.");
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

// 11. BORRAR JUGADAS EN SUPABASE
async function borrarJugada(e, id, esOficial) {
    e.stopPropagation();

    const confirmar = confirm("⚠️ ¿Estás seguro de que quieres eliminar esta jugada de la nube de forma permanente?");
    if (!confirmar) return;

    try {
        const { error } = await supabase
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

// 12. GESTIÓN DE LA CARGA DE JUGADAS DESDE SUPABASE
async function cargarJugada(id, esOficial) {
    if (tieneCambiosSinGuardar) {
        const confirmar = confirm("⚠️ Tienes cambios sin guardar. ¿Quieres descartarlos para abrir esta jugada?");
        if (!confirmar) return;
    }

    try {
        // Pedimos a Supabase la jugada específica con ese ID único
        const { data: jugada, error } = await supabase
            .from('jugadas')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        // Cargamos los datos de la jugada en la pizarra
        jugadaPasos = JSON.parse(JSON.stringify(jugada.pasos));
        pasoActivoIndex = 0;
        historialMovimientos = [];
        jugadaActivaId = id;
        nombreJugadaActiva = jugada.nombre;
        esJugadaOficialActiva = esOficial;
        tieneCambiosSinGuardar = false;

        aplicarAnimacionTemporal();
        aplicarPosicionesPantalla(jugadaPasos[0]); // Cargamos el primer paso de la jugada
        actualizarUI();
        mostrarToast(`📖 Jugada cargada: "${nombreJugadaActiva}"`);

    } catch (error) {
        console.error("Error al cargar la jugada de Supabase:", error);
        mostrarToast("❌ No se pudo descargar la jugada de la nube.");
    }
}

// 13. ACTUALIZAR PANEL DE BIBLIOTECA DESDE SUPABASE
async function cargarBiblioteca() {
    try {
        // Consultamos a Supabase para traernos todas las jugadas del servidor
        const { data: listadoJugadas, error } = await supabase
            .from('jugadas')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Separamos las jugadas usando lógica condicional
        const personales = listadoJugadas.filter(j => j.es_oficial === false);
        const oficiales = listadoJugadas.filter(j => j.es_oficial === true);

        // 1. Pintar Jugadas Personales de los entrenadores
        listPersonal.innerHTML = "";
        if (personales.length === 0) {
            listPersonal.innerHTML = '<div style="color: #64748b; font-size: 0.8rem; padding: 5px;">Ninguna jugada en la nube.</div>';
        } else {
            personales.forEach(j => {
                const activeClass = (jugadaActivaId === j.id) ? 'active' : '';
                // Mostramos el nombre de la jugada y quién la firmó
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

        // 2. Pintar Jugadas Oficiales de la Escuela
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
        console.error("Error al cargar la biblioteca de Supabase:", error);
        listPersonal.innerHTML = '<div style="color: #ef4444; font-size: 0.8rem; padding: 5px;">Error al conectar con la nube.</div>';
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