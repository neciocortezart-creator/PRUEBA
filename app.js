const { createClient } = supabase;
const supabaseUrl = 'https://rgwawwdldqodzmsizean.supabase.co'; 
const supabaseKey = 'sb_publishable_-4Q07zNvB5Ep9fLwIZW6Yw_axmOPTM7';
const polarDb = createClient(supabaseUrl, supabaseKey);

function switchTab(tabId) {
  const panelMenu = document.getElementById('panel-menu');
  const overlay = document.getElementById('panel-overlay');
  if (panelMenu && panelMenu.classList.contains('open')) {
      panelMenu.classList.remove('open');
      if (overlay) overlay.classList.remove('active');
  }

  let isAlreadyActive = false;
  const navBtn = document.getElementById('nav-' + tabId);
  if (navBtn && navBtn.classList.contains('active') && tabId !== 'home') {
      isAlreadyActive = true;
  }

  if (isAlreadyActive) {
      tabId = 'home';
  }

  document.getElementById('main-calculator').style.display = 'none';
  document.getElementById('view-graficas').style.display = 'none';
  document.getElementById('view-buscador').style.display = 'none'; 
  document.getElementById('view-historial').style.display = 'none';
  document.getElementById('view-citas').style.display = 'none';
  document.getElementById('view-config').style.display = 'none';
  document.getElementById('view-avatars').style.display = 'none';
  document.getElementById('view-usuario').style.display = 'none';

  const radar = document.getElementById('radar-precision');
  if (radar) radar.style.display = 'none';

  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

  if (tabId === 'home') {
    document.getElementById('main-calculator').style.display = 'grid'; 
    if (radar) radar.style.display = 'block';
    document.getElementById('nav-home').classList.add('active');
    
    if(document.getElementById('glucosa').value !== '' || document.getElementById('carbos').value !== '') {
       calcular(true);
    }
  } 
  else if (tabId === 'graficas') {
    document.getElementById('view-graficas').style.display = 'block';
    document.getElementById('nav-graficas').classList.add('active');
    renderGraficoPicos();
  } 
  else if (tabId === 'buscador') {
    document.getElementById('view-buscador').style.display = 'block';
    document.getElementById('nav-buscador').classList.add('active');
  }
  else if (tabId === 'historial') {
    document.getElementById('view-historial').style.display = 'block';
    if (radar) radar.style.display = 'block';
    document.getElementById('nav-historial').classList.add('active');
    actualizarVistaHistorial();
  } 
  else if (tabId === 'citas') {
    document.getElementById('view-citas').style.display = 'block';
    document.getElementById('nav-citas').classList.add('active');
    renderCitas();
  } 
  else if (tabId === 'config') {
    document.getElementById('view-config').style.display = 'block';
    document.getElementById('nav-config').classList.add('active');
  }
  else if (tabId === 'avatars') {
    document.getElementById('view-avatars').style.display = 'block';
    renderAvatarPanel();
  }
  else if (tabId === 'usuario') {
    document.getElementById('view-usuario').style.display = 'block';
  }
}

function actualizarRadar() {
  const historial = JSON.parse(localStorage.getItem('historial_polar') || '[]');
  const listaRadar = document.getElementById('lista-radar');
  if (!listaRadar) return;
  
  const ultimosTres = historial.slice(-3).reverse();
  if (ultimosTres.length === 0) {
      listaRadar.innerHTML = '<p style="font-size: 13px; font-weight: 700; opacity: 0.6; text-align: center;">Sin registros recientes.</p>';
      return;
  }

  const dict = { 'desayuno': 'Desayuno', 'mam': 'Once', 'almuerzo': 'Almuerzo', 'mpm': 'Merienda', 'cena': 'Cena', 'corroborar': 'Revisión', 'post-comida': '2H Post' };

  listaRadar.innerHTML = ultimosTres.map(reg => {
      const nombreComida = dict[reg.tipoComida] || 'Manual';
      const hora = reg.fecha.split(', ') || reg.fecha;
      let colorGlucosa = 'var(--text-primary)';
      if(reg.glucosa < 70) colorGlucosa = '#FF3B30';
      else if(reg.glucosa > 180) colorGlucosa = '#FF9F0A';
      else colorGlucosa = '#4CAF50';

      return `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: var(--bg-polar); border-radius: 12px; border: 1px solid var(--input-border);">
          <div style="display: flex; flex-direction: column;">
              <span style="font-size: 14px; font-weight: 900; color: var(--turquoise-strong); text-transform: uppercase;">${nombreComida}</span>
              <span style="font-size: 11px; font-weight: 800; color: var(--text-primary); opacity: 0.7;">${hora}</span>
          </div>
          <div style="text-align: right; display: flex; align-items: center; gap: 15px;">
              <div style="display: flex; flex-direction: column; align-items: flex-end;">
                  <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; opacity: 0.6;">Nivel</span>
                  <span style="font-size: 16px; font-weight: 900; color: ${colorGlucosa};">${reg.glucosa}</span>
              </div>
              <div style="display: flex; flex-direction: column; align-items: flex-end;">
                  <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; opacity: 0.6;">Dosis</span>
                  <span style="font-size: 18px; font-weight: 900; color: var(--text-primary); line-height: 1;">${reg.dosis}U</span>
              </div>
          </div>
      </div>`;
  }).join('');
}

async function sincronizarDatosNube() {
  const userId = localStorage.getItem('polar_user_id');
  if (!userId) return;

  await procesarColaOffline();

  const { data, error } = await polarDb
    .from('historial_polar')
    .select('*')
    .eq('paciente_id', userId)
    .order('created_at', { ascending: true }); 

  if (error) {
    console.error("Fallo en la sincronización:", error.message);
    return;
  }

  if (data && data.length > 0) {
    const historialDescargado = data.map(dbItem => {
      const d = new Date(dbItem.created_at);
      return {
        fecha: d.toLocaleString('es-CL'),
        iso: d.toISOString().split('T')[0],
        dosis: dbItem.dosis,
        glucosa: dbItem.glucosa,
        carbos: dbItem.carbos,
        tipoComida: dbItem.tipo_comida,
        timestamp: d.getTime()
      };
    });

    localStorage.setItem('historial_polar', JSON.stringify(historialDescargado));

    if (typeof renderGraficoPicos === 'function') renderGraficoPicos();
    if (document.getElementById('view-historial').style.display === 'block') {
      if (typeof actualizarVistaHistorial === 'function') actualizarVistaHistorial();
    }
    actualizarRadar();
  }
}

async function procesarColaOffline() {
  if(!navigator.onLine) return;
  let cola = JSON.parse(localStorage.getItem('polar_cola_sync') || '[]');
  if(cola.length === 0) return;
  
  const { error } = await polarDb.from('historial_polar').insert(cola);
  if(!error) {
     localStorage.removeItem('polar_cola_sync');
  }
}
window.addEventListener('online', procesarColaOffline);

function activarSuscripcionTiempoReal() {
  const userId = localStorage.getItem('polar_user_id');
  if (!userId) return;

  polarDb.removeAllChannels();

  polarDb.channel('radar-familiar-elite')
    .on(
      'postgres_changes',
      {
        event: '*', 
        schema: 'public', 
        table: 'historial_polar',
        filter: `paciente_id=eq.${userId}`
      },
      (payload) => {
        sincronizarDatosNube();
      }
    )
    .subscribe();
}

async function revisarRegistrosAntiguos() {
  const userId = localStorage.getItem('polar_user_id');
  if (!userId) return;

  const fechaLimite = new Date();
  fechaLimite.setDate(fechaLimite.getDate() - 30);
  const isoFechaLimite = fechaLimite.toISOString().split('T')[0];

  const { data: registrosViejos, error: errorSelect } = await polarDb
    .from('historial_polar')
    .select('id, created_at')
    .eq('paciente_id', userId)
    .lt('created_at', isoFechaLimite);

  if (errorSelect) return;

  if (registrosViejos && registrosViejos.length > 0) {
    if (confirm(`Líder, tienes ${registrosViejos.length} registros con más de 30 días de antigüedad. ¿Deseas descargar el PDF mensual ahora antes de que se borren automáticamente para mantener el sistema optimizado?`)) {
        generarPDFElite();
    }

    const idsBorrar = registrosViejos.map(r => r.id);
    const { error: errorDelete } = await polarDb
      .from('historial_polar')
      .delete()
      .in('id', idsBorrar);

    if (!errorDelete) {
       await sincronizarDatosNube();
    }
  }
}

function verificarSesion() {
  const session = localStorage.getItem('polar_session_activa'); 
  if (session === 'true') {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('main-app').style.display = 'block';
  } else {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('main-app').style.display = 'none';
  }
}

async function validarAcceso() {
  const user = document.getElementById('login-user').value.trim().toLowerCase();
  const pass = document.getElementById('login-pass').value.trim();

  if (!user || !pass) {
    alert("Líder, la excelencia exige que llenes todos los datos.");
    return;
  }

  const { data, error } = await polarDb.auth.signInWithPassword({
    email: user,
    password: pass,
  });

  if (error) {
    alert("Acceso Denegado. Verifica el correo o la contraseña.");
    document.getElementById('login-pass').value = '';
  } else {
    localStorage.setItem('polar_session_activa', 'true');
    localStorage.setItem('polar_rol', data.user.email);
    localStorage.setItem('polar_user_id', data.user.id); 
    
    const meta = data.user.user_metadata || {};
    if(meta.nombre_lider) {
        localStorage.setItem('polar_nombre_lider_' + data.user.id, meta.nombre_lider);
    }
    if(meta.config_elite) {
        config = meta.config_elite;
        localStorage.setItem('polar_config', JSON.stringify(config));
    }
    
    await sincronizarDatosNube();
    activarSuscripcionTiempoReal();
    await revisarRegistrosAntiguos();
    cargarNombreUsuario();
    
    document.getElementById('login-screen').style.opacity = '0';
    setTimeout(() => {
      verificarSesion();
      document.getElementById('login-screen').style.opacity = '1';
      window.location.reload(); 
    }, 400);
  }
}

async function cerrarSesion() {
  await polarDb.auth.signOut();
  localStorage.removeItem('polar_session_activa');
  localStorage.removeItem('polar_rol');
  localStorage.removeItem('polar_user_id');
  localStorage.removeItem('historial_polar'); 
  localStorage.removeItem('citas_polar');
  
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
  document.getElementById('lista-historial').innerHTML = '';
  document.getElementById('btn-usuario-nombre').innerText = 'Líder';
  
  switchTab('home');
  
  const panelMenu = document.getElementById('panel-menu');
  if (panelMenu.classList.contains('open')) toggleMenuPanel();
  verificarSesion();
}

async function guardarNombreUsuario() {
  const nuevoNombre = document.getElementById('input-nuevo-nombre').value.trim();
  const userId = localStorage.getItem('polar_user_id') || 'default';
  if(nuevoNombre) {
    localStorage.setItem('polar_nombre_lider_' + userId, nuevoNombre);
    document.getElementById('btn-usuario-nombre').innerText = nuevoNombre;
    polarDb.auth.updateUser({ data: { nombre_lider: nuevoNombre } });
    switchTab('home');
  }
}

function cargarNombreUsuario() {
  const userId = localStorage.getItem('polar_user_id') || 'default';
  const nombreGuardado = localStorage.getItem('polar_nombre_lider_' + userId) || 'Líder';
  document.getElementById('btn-usuario-nombre').innerText = nombreGuardado;
}

let backupData = null; 
let toastTimeout;

function activarDeshacer(tipo, datosViejos) { 
    backupData = { tipo: tipo, datos: datosViejos }; 
    const toast = document.getElementById('toast-undo'); 
    toast.classList.add('show'); 
    clearTimeout(toastTimeout); 
    toastTimeout = setTimeout(() => { toast.classList.remove('show'); backupData = null; }, 5000); 
}

function deshacerBorrado() {
  if (!backupData) return;
  if (backupData.tipo === 'citas') { 
      localStorage.setItem('citas_polar', JSON.stringify(backupData.datos)); 
      renderCitas(); 
  } 
  else if (backupData.tipo === 'historial') { 
      localStorage.setItem('historial_polar', JSON.stringify(backupData.datos)); 
      actualizarVistaHistorial(); 
      renderGraficoPicos(); 
      actualizarRadar();
  }
  document.getElementById('toast-undo').classList.remove('show'); 
  backupData = null;
}

const temasVisuales = {
  elite: { '--bg-polar': '#FAF8F5', '--white': '#FFFFFF', '--blue-ice-light': '#5B9BD5', '--blue-ice-mid': '#F3C623', '--turquoise-soft': '#088387', '--turquoise-strong': '#088387', '--text-primary': '#2C3A40', '--text-inverse': '#FFFFFF', '--text-dark': '#2C3A40', '--btn-text': '#FFFFFF', '--accent-btn': '#F05A4A', '--accent-btn-text': '#FFFFFF', '--card-bg': '#FFFFFF', '--card-text': '#2C3A40', '--input-bg': '#FFFFFF', '--input-text': '#1A1A1A', '--input-border': 'rgba(44, 58, 64, 0.20)', '--label-color': '#2C3A40', '--calendar-invert': '0', '--bg-card-glucose': '#088387', '--text-card-glucose': '#FFFFFF', '--bg-card-carbs': '#2C3A40', '--text-card-carbs': '#FFFFFF' },
  original: { '--bg-polar': '#F0F6F7', '--white': '#FFFFFF', '--blue-ice-light': '#D4E4E6', '--blue-ice-mid': '#A2C5C9', '--turquoise-soft': '#7AB0B2', '--turquoise-strong': '#4A8C8E', '--text-primary': '#1A2A30', '--text-inverse': '#FFFFFF', '--text-dark': '#1A2A30', '--btn-text': '#FFFFFF', '--accent-btn': '#bdff6f', '--accent-btn-text': '#1A2A30', '--card-bg': '#2C3A40', '--card-text': '#F0F6F7', '--input-bg': '#FFFFFF', '--input-text': '#1A2A30', '--input-border': 'rgba(0, 0, 0, 0.25)', '--label-color': '#1A2A30', '--calendar-invert': '1', '--bg-card-glucose': '#D4E4E6', '--text-card-glucose': '#1A2A30', '--bg-card-carbs': '#A2C5C9', '--text-card-carbs': '#1A2A30' },
  oscuro: { '--bg-polar': '#121212', '--white': '#1E1E1E', '--blue-ice-light': '#2C2C2C', '--blue-ice-mid': '#3A3A3A', '--turquoise-soft': '#66B2B4', '--turquoise-strong': '#4A8C8E', '--text-primary': '#F0F0F0', '--text-inverse': '#121212', '--text-dark': '#F0F0F0', '--btn-text': '#FFFFFF', '--accent-btn': '#bdff6f', '--accent-btn-text': '#121212', '--card-bg': '#1E1E1E', '--card-text': '#F0F0F0', '--input-bg': '#2A2A2A', '--input-text': '#F0F0F0', '--input-border': 'rgba(255, 255, 255, 0.4)', '--label-color': '#F0F0F0', '--calendar-invert': '1', '--bg-card-glucose': '#2C2C2C', '--text-card-glucose': '#F0F0F0', '--bg-card-carbs': '#3A3A3A', '--text-card-carbs': '#F0F0F0' },
  blanco: { '--bg-polar': '#F8F9FA', '--white': '#FFFFFF', '--blue-ice-light': '#E9ECEF', '--blue-ice-mid': '#CED4DA', '--turquoise-soft': '#495057', '--turquoise-strong': '#212529', '--text-primary': '#1A1A1A', '--text-inverse': '#FFFFFF', '--text-dark': '#1A1A1A', '--btn-text': '#FFFFFF', '--accent-btn': '#0D6EFD', '--accent-btn-text': '#FFFFFF', '--card-bg': '#E9ECEF', '--card-text': '#1A1A1A', '--input-bg': '#FFFFFF', '--input-text': '#1A1A1A', '--input-border': '#ADB5BD', '--label-color': '#1A1A1A', '--calendar-invert': '0', '--bg-card-glucose': '#E9ECEF', '--text-card-glucose': '#1A1A1A', '--bg-card-carbs': '#CED4DA', '--text-card-carbs': '#1A1A1A' },
  halloween: { '--bg-polar': '#2A162B', '--white': '#1A0B1A', '--blue-ice-light': '#582A4D', '--blue-ice-mid': '#B5452C', '--turquoise-soft': '#E88C15', '--turquoise-strong': '#E88C15', '--text-primary': '#F5D6B4', '--text-inverse': '#1A0B1A', '--text-dark': '#F5D6B4', '--btn-text': '#1A0B1A', '--accent-btn': '#B5452C', '--accent-btn-text': '#FFFFFF', '--card-bg': '#1A0B1A', '--card-text': '#F5D6B4', '--input-bg': '#2A162B', '--input-text': '#F5D6B4', '--input-border': '#E88C15', '--label-color': '#F5D6B4', '--calendar-invert': '1', '--bg-card-glucose': '#582A4D', '--text-card-glucose': '#F5D6B4', '--bg-card-carbs': '#B5452C', '--text-card-carbs': '#FFFFFF' },
  mustard_jet: { '--bg-polar': '#E4DFD8', '--white': '#FFFFFF', '--blue-ice-light': '#F2D04E', '--blue-ice-mid': '#24221B', '--turquoise-soft': '#F2D04E', '--turquoise-strong': '#24221B', '--text-primary': '#24221B', '--text-inverse': '#E4DFD8', '--text-dark': '#24221B', '--btn-text': '#FFFFFF', '--accent-btn': '#F2D04E', '--accent-btn-text': '#24221B', '--card-bg': '#FFFFFF', '--card-text': '#24221B', '--input-bg': '#FFFFFF', '--input-text': '#24221B', '--input-border': 'rgba(36, 34, 27, 0.25)', '--label-color': '#24221B', '--calendar-invert': '0', '--bg-card-glucose': '#24221B', '--text-card-glucose': '#FFFFFF', '--bg-card-carbs': '#F2D04E', '--text-card-carbs': '#24221B' },
  moonstone_orange: { '--bg-polar': '#7AA6B3', '--white': '#FFFFFF', '--blue-ice-light': '#EE6C29', '--blue-ice-mid': '#282B2B', '--turquoise-soft': '#EE6C29', '--turquoise-strong': '#282B2B', '--text-primary': '#282B2B', '--text-inverse': '#FFFFFF', '--text-dark': '#282B2B', '--btn-text': '#FFFFFF', '--accent-btn': '#EE6C29', '--accent-btn-text': '#FFFFFF', '--card-bg': '#FFFFFF', '--card-text': '#282B2B', '--input-bg': '#FFFFFF', '--input-text': '#282B2B', '--input-border': 'rgba(40, 43, 43, 0.3)', '--label-color': '#282B2B', '--calendar-invert': '0', '--bg-card-glucose': '#282B2B', '--text-card-glucose': '#FFFFFF', '--bg-card-carbs': '#EE6C29', '--text-card-carbs': '#282B2B' },
  persian_carrot: { '--bg-polar': '#EEEEEE', '--white': '#FFFFFF', '--blue-ice-light': '#EF8F00', '--blue-ice-mid': '#0038BC', '--turquoise-soft': '#EF8F00', '--turquoise-strong': '#0038BC', '--text-primary': '#0038BC', '--text-inverse': '#FFFFFF', '--text-dark': '#0038BC', '--btn-text': '#FFFFFF', '--accent-btn': '#EF8F00', '--accent-btn-text': '#FFFFFF', '--card-bg': '#FFFFFF', '--card-text': '#0038BC', '--input-bg': '#FFFFFF', '--input-text': '#0038BC', '--input-border': 'rgba(0, 56, 188, 0.25)', '--label-color': '#0038BC', '--calendar-invert': '0', '--bg-card-glucose': '#0038BC', '--text-card-glucose': '#FFFFFF', '--bg-card-carbs': '#EF8F00', '--text-card-carbs': '#1A1A1A' },
  mellow_cornflower: { '--bg-polar': '#DDD4C4', '--white': '#FFFFFF', '--blue-ice-light': '#F1C436', '--blue-ice-mid': '#5C88CD', '--turquoise-soft': '#F1C436', '--turquoise-strong': '#5C88CD', '--text-primary': '#1A2B4C', '--text-inverse': '#FFFFFF', '--text-dark': '#1A2B4C', '--btn-text': '#FFFFFF', '--accent-btn': '#F1C436', '--accent-btn-text': '#1A2B4C', '--card-bg': '#FFFFFF', '--card-text': '#1A2B4C', '--input-bg': '#FFFFFF', '--input-text': '#1A2B4C', '--input-border': 'rgba(26, 43, 76, 0.25)', '--label-color': '#1A2B4C', '--calendar-invert': '0', '--bg-card-glucose': '#5C88CD', '--text-card-glucose': '#FFFFFF', '--bg-card-carbs': '#F1C436', '--text-card-carbs': '#1A2B4C' }
};

function cambiarTema() { 
  const temaElegido = document.getElementById('cfg-tema').value; 
  config.tema = temaElegido; 
  localStorage.setItem('polar_config', JSON.stringify(config)); 
  aplicarTemaReal(temaElegido); 
  cargarAvatar(); 
  if (document.getElementById('view-graficas').style.display === 'block') {
    renderGraficoPicos();
  }
}

function aplicarTemaReal(temaNombre) { 
  const paleta = temasVisuales[temaNombre] || temasVisuales['elite']; 
  const root = document.documentElement; 
  for (const [key, value] of Object.entries(paleta)) { root.style.setProperty(key, value); } 
}

let usoRedondeoElite = true;
let diasFiltroBarras = 7;

function buscarDiaEspecifico() {
    const fechaSeleccionada = document.getElementById('buscador-fecha').value;
    const contenedorResultados = document.getElementById('resultado-buscador');

    if (!fechaSeleccionada) {
        contenedorResultados.style.display = 'none';
        return;
    }

    const historialCompleto = JSON.parse(localStorage.getItem('historial_polar') || '[]');
    const registrosDelDia = historialCompleto.filter(item => item.iso === fechaSeleccionada);

    contenedorResultados.style.display = 'block';
    contenedorResultados.style.animation = 'popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';

    if (registrosDelDia.length === 0) {
        contenedorResultados.innerHTML = '<p style="text-align: center; font-weight: 800; color: var(--text-primary); margin: 0; opacity: 0.6;">Sin registros de escudo en esta fecha.</p>';
        return;
    }

    const dictNombres = { 'desayuno': 'Desayuno', 'mam': 'Once', 'almuerzo': 'Almuerzo', 'mpm': 'Merienda', 'cena': 'Cena', 'corroborar': 'Revisión', 'post-comida': '2H Post' };
    const dictColores = { 'desayuno': '#FCA311', 'mam': '#D84B79', 'almuerzo': '#4CAF50', 'mpm': '#5B9BD5', 'cena': '#A35496', 'corroborar': '#2C3A40', 'post-comida': '#088387' };

    const partesFecha = fechaSeleccionada.split('-');
    const fechaLimpia = `${partesFecha}/${partesFecha}/${partesFecha[0]}`;

    let html = `<h4 style="font-size: 15px; font-weight: 900; color: var(--text-primary); margin-bottom: 12px; text-align: center; border-bottom: 1px dashed rgba(0,0,0,0.1); padding-bottom: 8px;">Auditoría del ${fechaLimpia}</h4>`;

    registrosDelDia.sort((a, b) => a.timestamp - b.timestamp);

    registrosDelDia.forEach(reg => {
        const nombreComida = dictNombres[reg.tipoComida] || 'Manual';
        const colorEtiqueta = dictColores[reg.tipoComida] || '#2C3A40';
        
        let colorGlucosa = 'var(--text-primary)';
        if(reg.glucosa < 70) colorGlucosa = '#FF3B30';
        else if(reg.glucosa > 180) colorGlucosa = '#FF9F0A';
        else colorGlucosa = '#4CAF50';

        const horaRegistro = reg.fecha.split(', ') || '-';

        html += `
        <div style="background: var(--white); border-radius: 12px; padding: 14px; margin-bottom: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.02); border-left: 5px solid ${colorEtiqueta};">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 15px; font-weight: 900; color: ${colorEtiqueta}; text-transform: uppercase;">${nombreComida}</span>
                <span style="font-size: 12px; font-weight: 900; background: rgba(0,0,0,0.05); padding: 2px 8px; border-radius: 10px; color: var(--text-primary);">${horaRegistro}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="font-size: 14px; font-weight: 700; line-height: 1.4;">
                    Nivel: <span style="font-size: 16px; font-weight: 900; color: ${colorGlucosa};">${reg.glucosa || '-'}</span> <br>
                    Carga: <strong style="color: var(--text-primary);">${reg.carbos || 0}g CHO</strong>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 11px; font-weight: 800; color: var(--text-primary); opacity: 0.6; text-transform: uppercase;">Dosis</div>
                    <div style="font-size: 22px; font-weight: 900; color: var(--turquoise-strong); line-height: 1;">${reg.dosis}U</div>
                </div>
            </div>
        </div>
        `;
    });

    contenedorResultados.innerHTML = html;
}

function toggleRedondeo() {
    usoRedondeoElite = !usoRedondeoElite;
    actualizarBotonRedondeoUI();
    localStorage.setItem('polar_redondeo_activo', usoRedondeoElite ? 'true' : 'false');
    if (document.getElementById('resultado').style.display === 'block') {
      calcular(true);
    }
}

function actualizarBotonRedondeoUI() {
    const btn = document.getElementById('btn-toggle-redondeo');
    if (!btn) return;
    if (usoRedondeoElite) {
        btn.innerText = "redondeo activado";
        btn.style.background = "var(--turquoise-strong)";
    } else {
        btn.innerText = "redondeo apagado";
        btn.style.background = "#FF3B30";
    }
}

function redondeoElite(valor) {
  if (!usoRedondeoElite) return Math.round(valor * 10) / 10;
  const valorLimpio = Math.round(valor * 100) / 100;
  const entero = Math.floor(valorLimpio);
  const decimal = Math.round((valorLimpio - entero) * 100) / 100;
  if (decimal >= 0.5) {
    return entero + 1;
  }
  return entero;
}

let deferredPrompt; 
let estadoEjercicio = 0; 
let calcHistoria = []; 
let calcPosicion = -1;

let config = {
  peso: 50, 
  toujeo: 56, 
  fc: {
    desayuno: 30,
    mam: 30,
    almuerzo: 30,
    mpm: 30,
    cena: 30,
    corroborar: 30
  },
  telEmergencia: "131", 
  telPapa: "973808283", 
  avatar: 0, 
  tema: "elite",
  ratios: { desayuno: 4, mam: 0, almuerzo: 5, mpm: 5, cena: 14, corroborar: 0 },
  metas: { antes: 100, correccion: 150 }
};

const svgOso = `<svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><circle cx="28" cy="40" r="16" fill="#FFFFFF"/><circle cx="72" cy="40" r="16" fill="#FFFFFF"/><path d="M 10 95 A 40 40 0 0 1 90 95 Z" fill="#FFFFFF"/><circle cx="38" cy="70" r="4.5" fill="#2C3A40"/><circle cx="62" cy="70" r="4.5" fill="#2C3A40"/><ellipse cx="50" cy="82" rx="7" ry="4" fill="#2C3A40"/></svg>`;
const svgZorro = `<svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><polygon points="15,50 35,20 45,50" fill="#E67E22"/><polygon points="85,50 65,20 55,50" fill="#E67E22"/><path d="M 10 95 A 40 40 0 0 1 90 95 Z" fill="#D35400"/><circle cx="38" cy="70" r="4.5" fill="#2C3A40"/><circle cx="62" cy="70" r="4.5" fill="#2C3A40"/><ellipse cx="50" cy="82" rx="5" ry="3" fill="#2C3A40"/></svg>`;
const svgPinguino = `<svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><path d="M 5 95 A 45 45 0 0 1 95 95 Z" fill="#2C3A40"/><path d="M 20 95 A 30 40 0 0 1 80 95 Z" fill="#FFFFFF"/><polygon points="45,65 55,65 50,75" fill="#F3C623"/><circle cx="40" cy="55" r="4" fill="#2C3A40"/><circle cx="60" cy="55" r="4" fill="#2C3A40"/></svg>`;
const svgFoca = `<svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><path d="M 10 95 A 40 30 0 0 1 90 95 Z" fill="#95A5A6"/><circle cx="35" cy="70" r="5" fill="#2C3A40"/><circle cx="65" cy="70" r="5" fill="#2C3A40"/><ellipse cx="50" cy="80" rx="6" ry="3" fill="#2C3A40"/></svg>`;
const svgBuho = `<svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><polygon points="20,40 35,15 50,40" fill="#8E44AD"/><polygon points="80,40 65,15 50,40" fill="#8E44AD"/><path d="M 10 95 A 40 40 0 0 1 90 95 Z" fill="#C39BD3"/><circle cx="35" cy="65" r="15" fill="#FFFFFF"/><circle cx="65" cy="65" r="15" fill="#FFFFFF"/><circle cx="35" cy="65" r="4" fill="#2C3A40"/><circle cx="65" cy="65" r="4" fill="#2C3A40"/><polygon points="47,72 53,72 50,82" fill="#F3C623"/></svg>`;
const svgLobo = `<svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><polygon points="20,45 35,15 45,45" fill="#7F8C8D"/><polygon points="80,45 65,15 55,45" fill="#7F8C8D"/><path d="M 10 95 A 40 40 0 0 1 90 95 Z" fill="#BDC3C7"/><circle cx="35" cy="65" r="4" fill="#2C3A40"/><circle cx="65" cy="65" r="4" fill="#2C3A40"/><ellipse cx="50" cy="80" rx="6" ry="4" fill="#2C3A40"/></svg>`;
const svgTigre = `<svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><circle cx="25" cy="45" r="12" fill="#F39C12"/><circle cx="75" cy="45" r="12" fill="#F39C12"/><path d="M 10 95 A 40 40 0 0 1 90 95 Z" fill="#E67E22"/><path d="M 30 55 Q 50 65 70 55" stroke="#2C3A40" stroke-width="3" fill="none"/><path d="M 25 65 Q 50 75 75 65" stroke="#2C3A40" stroke-width="3" fill="none"/><circle cx="38" cy="75" r="4" fill="#2C3A40"/><circle cx="62" cy="75" r="4" fill="#2C3A40"/><ellipse cx="50" cy="85" rx="5" ry="3" fill="#C0392B"/></svg>`;
const svgPanda = `<svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><circle cx="28" cy="40" r="14" fill="#2C3A40"/><circle cx="72" cy="40" r="14" fill="#2C3A40"/><path d="M 10 95 A 40 40 0 0 1 90 95 Z" fill="#FFFFFF"/><ellipse cx="35" cy="70" rx="10" ry="14" fill="#2C3A40"/><ellipse cx="65" cy="70" rx="10" ry="14" fill="#2C3A40"/><circle cx="35" cy="68" r="3" fill="#FFFFFF"/><circle cx="65" cy="68" r="3" fill="#FFFFFF"/><ellipse cx="50" cy="85" rx="6" ry="3" fill="#2C3A40"/></svg>`;
const svgUnicornio = `<svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><polygon points="40,45 50,10 60,45" fill="#F3C623"/><path d="M 20 95 Q 10 60 30 45" stroke="#5B9BD5" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M 80 95 Q 90 60 70 45" stroke="#F05A4A" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M 15 95 A 35 35 0 0 1 85 95 Z" fill="#FDFEFE"/><circle cx="38" cy="70" r="4" fill="#2C3A40"/><circle cx="62" cy="70" r="4.5" fill="#2C3A40"/><ellipse cx="50" cy="82" rx="5" ry="3" fill="#F05A4A"/></svg>`;
const svgDragon = `<svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><polygon points="30,45 50,20 70,45" fill="#F05A4A"/><polygon points="10,60 25,35 40,60" fill="#F05A4A"/><polygon points="90,60 75,35 60,60" fill="#F05A4A"/><path d="M 10 95 A 40 40 0 0 1 90 95 Z" fill="#27AE60"/><circle cx="35" cy="70" r="5" fill="#F1C40F"/><circle cx="65" cy="70" r="5" fill="#F1C40F"/><circle cx="35" cy="70" r="2" fill="#2C3A40"/><circle cx="65" cy="70" r="2" fill="#2C3A40"/><rect x="42" y="85" width="4" height="4" fill="#2C3A40"/><rect x="54" y="85" width="4" height="4" fill="#2C3A40"/></svg>`;

const avatares = [
  { icon: svgOso, name: 'Oso Polar (Líder)', req: 0, desc: 'Líder desde el día 1.' },
  { icon: svgZorro, name: 'Zorro Ártico', req: 3, desc: 'Requiere 3 días estables.' },
  { icon: svgPinguino, name: 'Pingüino Emperador', req: 7, desc: 'Requiere 1 semana estable.' },
  { icon: svgFoca, name: 'Foca Valiente', req: 10, desc: 'Requiere 10 días de excelencia.' },
  { icon: svgBuho, name: 'Búho Nival', req: 14, desc: 'Requiere 2 semanas estables.' },
  { icon: svgLobo, name: 'Lobo Alfa', req: 18, desc: 'Requiere 18 días de liderazgo.' },
  { icon: svgTigre, name: 'Tigre Blanco', req: 21, desc: 'Requiere 3 semanas estables.' },
  { icon: svgPanda, name: 'Panda Zen', req: 25, desc: 'Requiere 25 días estables.' },
  { icon: svgUnicornio, name: 'Unicornio Místico', req: 28, desc: 'Requiere 4 semanas estables.' },
  { icon: svgDragon, name: 'Dragón Legendario', req: 35, desc: 'Requiere 35 días absolutos.' }
];

const avataresBgColors = ['#197B79', '#E55938', '#73A5D4', '#7BA68D', '#2B3C46', '#1A7A78', '#EFBA34', '#799E7A', '#FA65ED', '#213B41'];

function contarDiasEstables() {
  const historial = JSON.parse(localStorage.getItem('historial_polar') || '[]'); 
  const glucosasPorDia = {};
  
  historial.forEach(reg => { 
      if (reg.iso && reg.glucosa) { 
          if (!glucosasPorDia[reg.iso]) glucosasPorDia[reg.iso] = []; 
          glucosasPorDia[reg.iso].push(parseFloat(reg.glucosa)); 
      } 
  });
  
  let estables = 0;
  for (let fecha in glucosasPorDia) {
    let lecturas = glucosasPorDia[fecha].filter(g => !isNaN(g)); 
    if (lecturas.length === 0) continue;
    
    let crisis = lecturas.find(g => g < 65 || g > 250);
    if (!crisis) { 
        estables++; 
    }
  }
  return estables;
}

function renderAvatarPanel() {
  const diasEstables = contarDiasEstables(); 
  const gridContainer = document.getElementById('avatars-grid-container');
  
  let gridHTML = '';
  avatares.forEach((av, index) => {
    const desbloqueado = diasEstables >= av.req;
    const isActive = (config.avatar === index);
    const statusClass = desbloqueado ? '' : 'locked';
    const activeClass = isActive ? 'active' : '';
    const bg = avataresBgColors[index] || '#2C3A40';
    const diasTexto = index === 0 ? 'Nivel Base' : `${av.req} Días`;
    const nombreCorto = av.name.replace(' Emperador', '').replace(' Legendario', ' Leyenda');

    gridHTML += `
      <div class="avatar-card ${statusClass} ${activeClass}" onclick="${desbloqueado ? `seleccionarAvatarDirecto(${index})` : 'null'}">
        <div class="avatar-bg" style="background-color: ${bg};">
          <span style="display: block; width: 100%; height: 100%;">${av.icon}</span>
        </div>
        <h4>${nombreCorto}</h4>
        <p>${diasTexto}</p>
      </div>
    `;
  });
  gridContainer.innerHTML = gridHTML;
}

function seleccionarAvatarDirecto(index) { 
  config.avatar = index; 
  localStorage.setItem('polar_config', JSON.stringify(config)); 
  cargarAvatar(); 
  renderAvatarPanel(); 
  alert("¡Poder equipado con excelencia!"); 
}

function cargarAvatar() { 
  document.getElementById('main-bear-icon').innerHTML = avatares[config.avatar || 0].icon; 
}

function obtenerFechaLocalISO() { 
  const ahora = new Date(); 
  const tzOffset = ahora.getTimezoneOffset() * 60000; 
  return new Date(ahora.getTime() - tzOffset).toISOString().split('T')[0]; 
}

function obtenerFcComida(comidaKey) {
  const idMap = {
    'desayuno': 'cfg-fc-desayuno',
    'mam': 'cfg-fc-mam',
    'almuerzo': 'cfg-fc-alm',
    'mpm': 'cfg-fc-mpm',
    'cena': 'cfg-fc-cena',
    'corroborar': 'cfg-fc-corroborar'
  };

  const inputEl = document.getElementById(idMap[comidaKey]);
  if (inputEl && inputEl.value !== '') {
    return parseFloat(inputEl.value) || 30;
  }

  if (config.fc && typeof config.fc === 'object') {
    return parseFloat(config.fc[comidaKey]) || parseFloat(config.fc.desayuno) || 30;
  }

  if (typeof config.fc === 'number') {
    return config.fc;
  }

  return 30;
}

window.addEventListener('DOMContentLoaded', async () => {
  setTimeout(() => { 
      document.getElementById('splash-screen').classList.add('splash-oculto'); 
      if(localStorage.getItem('polar_session_activa') === 'true') {
          const navBottom = document.querySelector('.bottom-nav');
          if(navBottom) navBottom.classList.add('show');
      }
  }, 1500);

  verificarSesion();
  
  if (localStorage.getItem('polar_session_activa') === 'true') {
    const { data: { session } } = await polarDb.auth.getSession();
    
    if (session) {
        await sincronizarDatosNube();
        activarSuscripcionTiempoReal();
    } else {
        cerrarSesion();
    }
  }

  cargarNombreUsuario();

  const configGuardada = localStorage.getItem('polar_config');
  if (configGuardada) { 
      config = JSON.parse(configGuardada); 
      if (typeof config.ratios === 'undefined') config.ratios = { desayuno: 4, mam: 0, almuerzo: 5, mpm: 5, cena: 14, corroborar: 0 };
      if (typeof config.ratios.corroborar === 'undefined') config.ratios.corroborar = 0; 
      if (typeof config.peso === 'undefined') config.peso = 50; 
      if (typeof config.avatar === 'undefined') config.avatar = 0;
      if (typeof config.tema === 'undefined') config.tema = "elite"; 
      if (typeof config.metas === 'undefined') config.metas = { antes: 100, correccion: 150 };

      if (typeof config.fc === 'number' || typeof config.fc === 'string') {
        const valFc = parseFloat(config.fc) || 30;
        config.fc = { desayuno: valFc, mam: valFc, almuerzo: valFc, mpm: valFc, cena: valFc, corroborar: valFc };
      } else if (!config.fc || typeof config.fc !== 'object') {
        config.fc = { desayuno: 30, mam: 30, almuerzo: 30, mpm: 30, cena: 30, corroborar: 30 };
      } else {
        if (typeof config.fc.desayuno === 'undefined') config.fc.desayuno = 30;
        if (typeof config.fc.mam === 'undefined') config.fc.mam = 30;
        if (typeof config.fc.almuerzo === 'undefined') config.fc.almuerzo = 30;
        if (typeof config.fc.mpm === 'undefined') config.fc.mpm = 30;
        if (typeof config.fc.cena === 'undefined') config.fc.cena = 30;
        if (typeof config.fc.corroborar === 'undefined') config.fc.corroborar = 30;
      }
  }

  const estadoRedondeoGuardado = localStorage.getItem('polar_redondeo_activo');
  if (estadoRedondeoGuardado !== null) {
    usoRedondeoElite = (estadoRedondeoGuardado === 'true');
  }
  
  document.getElementById('cfg-tema').value = config.tema; 
  aplicarTemaReal(config.tema);

  document.getElementById('cfg-peso').value = config.peso;
  document.getElementById('cfg-toujeo').value = config.toujeo; 

  if (document.getElementById('cfg-fc-desayuno')) document.getElementById('cfg-fc-desayuno').value = config.fc.desayuno;
  if (document.getElementById('cfg-fc-mam')) document.getElementById('cfg-fc-mam').value = config.fc.mam;
  if (document.getElementById('cfg-fc-alm')) document.getElementById('cfg-fc-alm').value = config.fc.almuerzo;
  if (document.getElementById('cfg-fc-mpm')) document.getElementById('cfg-fc-mpm').value = config.fc.mpm;
  if (document.getElementById('cfg-fc-cena')) document.getElementById('cfg-fc-cena').value = config.fc.cena;
  if (document.getElementById('cfg-fc-corroborar')) document.getElementById('cfg-fc-corroborar').value = config.fc.corroborar;

  document.getElementById('cfg-tel-emergencia').value = config.telEmergencia; 
  document.getElementById('cfg-tel-papa').value = config.telPapa;
  
  document.getElementById('cfg-meta-antes').value = config.metas.antes;
  document.getElementById('cfg-meta-cor').value = config.metas.correccion;
  
  if (document.getElementById('cfg-r-desayuno')) document.getElementById('cfg-r-desayuno').value = config.ratios.desayuno; 
  if (document.getElementById('cfg-r-mam')) document.getElementById('cfg-r-mam').value = config.ratios.mam; 
  if (document.getElementById('cfg-r-alm')) document.getElementById('cfg-r-alm').value = config.ratios.almuerzo; 
  if (document.getElementById('cfg-r-mpm')) document.getElementById('cfg-r-mpm').value = config.ratios.mpm; 
  if (document.getElementById('cfg-r-cena')) document.getElementById('cfg-r-cena').value = config.ratios.cena;
  
  actualizarDropdownMetas(); 
  actualizarRecordatoriosUI();
  actualizarTextosComida(); 
  renderCitas(); 
  renderGraficoPicos(); 
  verificarCitasProximas(); 
  cargarAvatar(); 
  actualizarBotonRedondeoUI();
  autoSeleccionarComida(); 

  document.getElementById('btn-llamar-emergencia').href = "tel:" + config.telEmergencia;
  document.getElementById('btn-llamar-papa').href = "tel:" + config.telPapa;

  const btnInstall = document.getElementById('btn-install'); 
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream; 
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  if (!isStandalone && isIOS) { 
    btnInstall.style.display = 'flex'; 
  }
  
  switchTab('home');
  actualizarRadar();
});

window.addEventListener('beforeinstallprompt', (e) => { 
  e.preventDefault(); 
  deferredPrompt = e; 
  document.getElementById('btn-install').style.display = 'flex'; 
});

function instalarApp() { 
  if (deferredPrompt) { 
    deferredPrompt.prompt(); 
    deferredPrompt.userChoice.then((choiceResult) => { 
      if (choiceResult.outcome === 'accepted') document.getElementById('btn-install').style.display = 'none'; 
      deferredPrompt = null; 
    }); 
  } else { 
    alert("Instala desde las opciones de tu navegador agregando a pantalla de inicio."); 
  } 
}

function toggleMenuPanel() {
  const panel = document.getElementById('panel-menu'); 
  const overlay = document.getElementById('panel-overlay'); 
  if (panel.classList.contains('open')) { 
    panel.classList.remove('open'); 
    overlay.classList.remove('active'); 
  } else { 
    panel.classList.add('open'); 
    overlay.classList.add('active'); 
  }
}

function cerrarOverlays() { 
  document.getElementById('panel-menu').classList.remove('open'); 
  document.getElementById('panel-overlay').classList.remove('active'); 
}

function agregarCita() {
  const f = document.getElementById('cita-fecha').value; 
  const h = document.getElementById('cita-hora').value; 
  const e = document.getElementById('cita-especialista').value.trim();
  if (!f || !h || !e) { alert("Llena todo para agendar con excelencia."); return; }
  
  let citas = JSON.parse(localStorage.getItem('citas_polar') || '[]'); 
  citas.push({ id: Date.now(), fecha: f, hora: h, specialist: e }); 
  citas.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  
  localStorage.setItem('citas_polar', JSON.stringify(citas)); 
  document.getElementById('cita-fecha').value = ''; 
  document.getElementById('cita-hora').value = ''; 
  document.getElementById('cita-especialista').value = ''; 
  renderCitas(); 
  verificarCitasProximas();
  agregarAlCalendario(e, f, h);
}

function borrarCita(id) { 
    let citas = JSON.parse(localStorage.getItem('citas_polar') || '[]'); 
    const cv = citas; 
    citas = citas.filter(c => c.id !== id); 
    localStorage.setItem('citas_polar', JSON.stringify(citas)); 
    renderCitas(); 
    activarDeshacer('citas', cv);
}

function agregarAlCalendario(especialista, fecha, hora) {
  const start = fecha.replace(/-/g, '') + 'T' + hora.replace(':', '') + '00';
  let horaFin = String(parseInt(hora.split(':')[0]) + 1).padStart(2, '0');
  if (horaFin === '24') horaFin = '00';
  const end = fecha.replace(/-/g, '') + 'T' + horaFin + hora.split(':') + '00';
  const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=Cita+Médica:+${encodeURIComponent(especialista)}&dates=${start}/${end}&details=Cita+agendada+desde+Polar`;
  window.open(url, '_blank');
}

function renderCitas() {
  const lista = document.getElementById('lista-citas'); 
  const citas = JSON.parse(localStorage.getItem('citas_polar') || '[]');
  if (citas.length === 0) { 
    lista.innerHTML = '<p style="text-align: center; color: var(--text-primary); font-weight: 700; font-size: 14px;">No hay citas pendientes.</p>'; 
    return; 
  }
  lista.innerHTML = citas.map(cita => {
    const pF = cita.fecha.split('-'); 
    const fechaLimpia = `${pF}/${pF}/${pF[0]}`;
    return `<div class="cita-card">
      <div>
        <div class="cita-titulo">${cita.specialist || cita.especialista}</div>
        <div class="cita-fecha">${fechaLimpia} | ${cita.hora}</div>
      </div>
      <div style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end;">
        <button class="btn-borrar-cita" onclick="borrarCita(${cita.id})">Borrar</button>
      </div>
    </div>`;
  }).join('');
}

function verificarCitasProximas() {
  const citas = JSON.parse(localStorage.getItem('citas_polar') || '[]');
  if (citas.length === 0) return;
  
  const isoHoy = obtenerFechaLocalISO();
  
  citas.forEach(cita => {
    if (cita.fecha === isoHoy) {
      const keyNotif = `notif_cita_hoy_${cita.fecha}_${cita.hora}`;
      if (!localStorage.getItem(keyNotif)) {
        if (Notification.permission !== "granted") {
          Notification.requestPermission();
        }

        if ("Notification" in window && Notification.permission === "granted") {
          navigator.serviceWorker.ready.then(registration => {
            registration.showNotification("¡Atención líder, cita hoy!", {
              body: `Hoy tienes cita con ${cita.specialist || cita.especialista} a las ${cita.hora}. ¡Prepárate con excelencia!`,
              icon: "polar-logo.png",
              vibrate: [200, 100, 200, 100, 200]
            });
          });
        }
        localStorage.setItem(keyNotif, 'enviada');
      }
    }
  });
}

function actualizarRecordatoriosUI() { 
    const txtToujeo = document.getElementById('txt-toujeo');
    if (txtToujeo) { txtToujeo.innerText = config.toujeo; }
}

function generarPDFElite() {
    const historial = JSON.parse(localStorage.getItem('historial_polar') || '[]');
    
    const opt = {
      margin:       15,
      filename:     'Reporte_Clinico_Polar.pdf',
      image:        { type: 'jpeg', quality: 1 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    const divPDF = document.createElement('div');
    divPDF.style.padding = '10px';
    divPDF.style.fontFamily = 'Nunito, sans-serif';
    divPDF.style.color = '#2C3A40';
    
    let html = `<h1 style="color: #088387; text-align: center; font-size: 26px; margin-bottom: 5px; font-weight: 900; text-transform: uppercase;">Reporte Clínico Polar</h1>`;
    html += `<p style="text-align: center; font-size: 13px; margin-bottom: 25px; color: #555;">Generado el: ${new Date().toLocaleDateString()}</p>`;
    
    html += `<div style="background: #F0F6F7; padding: 16px; border-radius: 12px; margin-bottom: 25px; border-left: 6px solid #088387;">
      <h3 style="color: #088387; margin-bottom: 12px; font-size: 18px; margin-top:0; font-weight: 900;">Esquema Médico Actual</h3>
      <ul style="font-size: 14px; line-height: 1.6; list-style: none; padding: 0; margin: 0; font-weight: 700;">
        <li><strong>Basal (Toujeo):</strong> ${config.toujeo} U</li>
        <li><strong>Factores de Corrección:</strong> Des: ${config.fc.desayuno} | Once: ${config.fc.mam} | Alm: ${config.fc.almuerzo} | PM: ${config.fc.mpm} | Cena: ${config.fc.cena} | Rev: ${config.fc.corroborar}</li>
        <li><strong>Ratios:</strong> Desayuno R${config.ratios.desayuno} | Once R${config.ratios.mam} | Almuerzo R${config.ratios.almuerzo} | PM R${config.ratios.mpm} | Cena R${config.ratios.cena}</li>
      </ul>
    </div>`;

    html += `<h3 style="color: #088387; border-bottom: 2px solid #088387; padding-bottom: 6px; margin-bottom: 15px; font-size: 18px; font-weight: 900;">Registro Diario de Mediciones</h3>`;
    
    if (historial.length === 0) {
      html += "<p style='font-size: 14px; text-align:center; font-weight: 700;'>Sin registros en la bóveda.</p>";
    } else {
      html += `<table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">
        <thead>
          <tr style="background-color: #088387; color: white;">
            <th style="padding: 12px; border-radius: 8px 0 0 0;">Fecha / Hora</th>
            <th style="padding: 12px;">Comida</th>
            <th style="padding: 12px;">Glucosa</th>
            <th style="padding: 12px;">CHO</th>
            <th style="padding: 12px; border-radius: 0 8px 0 0;">Dosis</th>
          </tr>
        </thead>
        <tbody>`;
        
      const historialReverso = historial.slice().reverse();
      const dict = { 'desayuno': 'Desayuno', 'mam': 'Once', 'almuerzo': 'Almuerzo', 'mpm': 'Merienda PM', 'cena': 'Cena', 'corroborar': 'Revisión', 'post-comida': '2H Post' };

      historialReverso.forEach((item, index) => {
        const bgRow = index % 2 === 0 ? '#FFFFFF' : '#F9F9F9';
        const evento = item.tipoComida ? dict[item.tipoComida] : 'Manual';
        
        let colorGlucosa = '#2C3A40';
        let pesoGlucosa = '700';
        if(item.glucosa < 70) { colorGlucosa = '#FF3B30'; pesoGlucosa = '900'; }
        else if (item.glucosa > 180) { colorGlucosa = '#FF9F0A'; pesoGlucosa = '900'; }

        html += `<tr style="background-color: ${bgRow}; border-bottom: 1px solid #EAEAEA;">
          <td style="padding: 12px; font-weight: 700;">${item.fecha}</td>
          <td style="padding: 12px; font-weight: 700;">${evento}</td>
          <td style="padding: 12px; font-weight: ${pesoGlucosa}; color: ${colorGlucosa};">${item.glucosa || '-'}</td>
          <td style="padding: 12px; font-weight: 700;">${item.carbos || 0}g</td>
          <td style="padding: 12px; font-weight: 900; color: #088387;">${item.dosis} U</td>
        </tr>`;
      });
      html += `</tbody></table>`;
    }

    divPDF.innerHTML = html;
    html2pdf().set(opt).from(divPDF).save();
}

async function guardarConfig() {
  config.peso = parseFloat(document.getElementById('cfg-peso').value) || 50;
  config.toujeo = parseFloat(document.getElementById('cfg-toujeo').value) || 0; 
  config.telEmergencia = document.getElementById('cfg-tel-emergencia').value || "131"; 
  config.telPapa = document.getElementById('cfg-tel-papa').value || "973808283";
  
  if (!config.fc || typeof config.fc !== 'object') {
    config.fc = {};
  }
  if (document.getElementById('cfg-fc-desayuno')) config.fc.desayuno = parseFloat(document.getElementById('cfg-fc-desayuno').value) || 30;
  if (document.getElementById('cfg-fc-mam')) config.fc.mam = parseFloat(document.getElementById('cfg-fc-mam').value) || 30;
  if (document.getElementById('cfg-fc-alm')) config.fc.almuerzo = parseFloat(document.getElementById('cfg-fc-alm').value) || 30;
  if (document.getElementById('cfg-fc-mpm')) config.fc.mpm = parseFloat(document.getElementById('cfg-fc-mpm').value) || 30;
  if (document.getElementById('cfg-fc-cena')) config.fc.cena = parseFloat(document.getElementById('cfg-fc-cena').value) || 30;
  if (document.getElementById('cfg-fc-corroborar')) config.fc.corroborar = parseFloat(document.getElementById('cfg-fc-corroborar').value) || 30;

  let valAntes = document.getElementById('cfg-meta-antes').value;
  let valCor = document.getElementById('cfg-meta-cor').value;

  config.metas.antes = valAntes ? parseFloat(valAntes) : 100;
  config.metas.correccion = valCor ? parseFloat(valCor) : 150;

  document.getElementById('cfg-meta-antes').value = config.metas.antes;
  document.getElementById('cfg-meta-cor').value = config.metas.correccion;
  
  if(document.getElementById('cfg-r-desayuno')) config.ratios.desayuno = parseFloat(document.getElementById('cfg-r-desayuno').value) || 0;
  if(document.getElementById('cfg-r-mam')) config.ratios.mam = parseFloat(document.getElementById('cfg-r-mam').value) || 0;
  if(document.getElementById('cfg-r-alm')) config.ratios.almuerzo = parseFloat(document.getElementById('cfg-r-alm').value) || 0;
  if(document.getElementById('cfg-r-mpm')) config.ratios.mpm = parseFloat(document.getElementById('cfg-r-mpm').value) || 0;
  if(document.getElementById('cfg-r-cena')) config.ratios.cena = parseFloat(document.getElementById('cfg-r-cena').value) || 0;
  
  localStorage.setItem('polar_config', JSON.stringify(config));
  polarDb.auth.updateUser({ data: { config_elite: config } });
  
  actualizarRecordatoriosUI();
  actualizarDropdownMetas();
  actualizarTextosComida(); 
  
  document.getElementById('btn-llamar-emergencia').href = "tel:" + config.telEmergencia;
  document.getElementById('btn-llamar-papa').href = "tel:" + config.telPapa;

  switchTab('home'); 
  alert("Metas, factores de corrección y control guardados con éxito.");
}

function actualizarDropdownMetas() {
  const select = document.getElementById('meta');
  if (!select) return;
  const antes = config.metas.antes;
  const cor = config.metas.correccion;
  
  select.innerHTML = `
    <option value="${antes}">Antes de comer (${antes})</option>
    <option value="${cor}">Corrección (${cor})</option>
  `;
}

function determinarComidaAutomatica() {
  const historial = JSON.parse(localStorage.getItem('historial_polar') || '[]');
  const hoyIso = obtenerFechaLocalISO();
  const registrosHoy = historial.filter(r => r.iso === hoyIso);

  if (registrosHoy.length === 0) return 'desayuno';

  const principales = registrosHoy.filter(r => ['desayuno', 'mam', 'almuerzo', 'mpm', 'cena'].includes(r.tipoComida));
  if (principales.length === 0) return 'desayuno';

  const ultimaPrincipal = principales[principales.length - 1];
  const timestampUltima = ultimaPrincipal.timestamp;

  const corroboracionesPost = registrosHoy.filter(r => (r.tipoComida === 'corroborar' || r.tipoComida === 'post-comida') && r.timestamp > timestampUltima);
  const yaCorroborado = corroboracionesPost.length > 0;

  const horasPasadas = (Date.now() - timestampUltima) / 3600000;
  const secuencia = ['desayuno', 'mam', 'almuerzo', 'mpm', 'cena'];
  const idx = secuencia.indexOf(ultimaPrincipal.tipoComida);
  const nextMeal = secuencia[(idx + 1) % secuencia.length];

  if (!yaCorroborado) {
      if (horasPasadas >= 1.98 && horasPasadas <= 3.5) {
          return 'corroborar';
      }
  }

  return nextMeal;
}

function autoSeleccionarComida() {
  const select = document.getElementById('comida');
  if (!select) return;
  
  if (select.dataset.manual === 'true') return;
  
  const sugerida = determinarComidaAutomatica();
  if (select.value !== sugerida) {
      select.value = sugerida;
      actualizarTextosComida();
  }
}

function actualizarTextosComida() {
  const s = document.getElementById('comida');
  const ratioDes = document.getElementById('cfg-r-desayuno') ? document.getElementById('cfg-r-desayuno').value : config.ratios.desayuno;
  const ratioMam = document.getElementById('cfg-r-mam') ? document.getElementById('cfg-r-mam').value : config.ratios.mam;
  const ratioAlm = document.getElementById('cfg-r-alm') ? document.getElementById('cfg-r-alm').value : config.ratios.almuerzo;
  const ratioMpm = document.getElementById('cfg-r-mpm') ? document.getElementById('cfg-r-mpm').value : config.ratios.mpm;
  const ratioCena = document.getElementById('cfg-r-cena') ? document.getElementById('cfg-r-cena').value : config.ratios.cena;

  s.options[0].text = `DESAYUNO (R${ratioDes})`; 
  s.options.text = `ONCE (R${ratioMam})`; 
  s.options.text = `ALMUERZO (R${ratioAlm})`; 
  s.options.text = `MERIENDA TARDE (R${ratioMpm})`; 
  s.options.text = `CENA (R${ratioCena})`; 
  if(s.options) s.options.text = `CORROBORAR (SOLO CORRECCIÓN)`;
  
  const meal = s.value;
  const inputActivo = document.getElementById('cfg-r-' + meal);
  const valActivo = inputActivo ? inputActivo.value : (config.ratios[meal] || 0);
  const labelCarbos = document.getElementById('label-carbos');
  if (labelCarbos) { labelCarbos.innerHTML = `comida CHO R${valActivo}`; }
  
  const selectMeta = document.getElementById('meta');
  if(selectMeta) {
    if (meal === 'corroborar') {
      selectMeta.value = config.metas.correccion;
    } else {
      selectMeta.value = config.metas.antes;
    }
  }
}

function despertarPolar() { 
  const b = document.getElementById('polar-bear'); 
  b.classList.remove('sleeping'); 
  b.classList.add('awake'); 
}

function dormirPolar() { 
  const b = document.getElementById('polar-bear'); 
  b.classList.remove('awake'); 
  b.classList.add('sleeping'); 
}

function setTendencia(val, fromNav = false) {
    const inputTrend = document.getElementById('tendencia');
    if(inputTrend) inputTrend.value = val;
    if(!fromNav && typeof calcular === 'function') calcular(false);
}

function guardarDosisAplicada(e, dosis, glucosa, carbos, tipoComida) {
  if (e) {
    e.preventDefault(); 
    e.stopPropagation();
  }

  const userId = localStorage.getItem('polar_user_id');
  if (!userId) {
      alert("Error de seguridad: La sesión no es válida. Vuelve a iniciar sesión.");
      return;
  }

  const ahora = new Date(); 
  const fecha = ahora.toLocaleString('es-CL'); 
  const isoFecha = obtenerFechaLocalISO(); 

  let historial = JSON.parse(localStorage.getItem('historial_polar') || '[]'); 
  historial.push({ fecha: fecha, iso: isoFecha, dosis: dosis, glucosa: glucosa, carbos: carbos, tipoComida: tipoComida, timestamp: ahora.getTime() }); 
  localStorage.setItem('historial_polar', JSON.stringify(historial));

  polarDb.from('historial_polar').insert([
      { paciente_id: userId, glucosa: glucosa, carbos: carbos, dosis: dosis, tipo_comida: tipoComida }
  ]).then(({ error }) => {
      if (error) throw error;
  }).catch((err) => {
      let colaSync = JSON.parse(localStorage.getItem('polar_cola_sync') || '[]');
      colaSync.push({ paciente_id: userId, glucosa: glucosa, carbos: carbos, dosis: dosis, tipo_comida: tipoComida, created_at: new Date().toISOString() });
      localStorage.setItem('polar_cola_sync', JSON.stringify(colaSync));
  });

  document.getElementById('glucosa').value = ''; 
  document.getElementById('carbos').value = ''; 
  document.getElementById('resultado').style.display = 'none'; 
  delete document.getElementById('comida').dataset.manual; 
  dormirPolar(); 
  autoSeleccionarComida(); 
  setTendencia('estable', true); 

  actualizarRadar();
  switchTab('home');
}

function actualizarVistaHistorial() {
  const lista = document.getElementById('lista-historial'); 
  const historial = JSON.parse(localStorage.getItem('historial_polar') || '[]');
  if (historial.length === 0) { 
    lista.innerHTML = '<p style="text-align: center; color: var(--text-primary); font-weight: 700; font-size: 14px;">Aún no hay registros.</p>'; 
    return; 
  }
  const dict = { 'desayuno': 'Desayuno', 'mam': 'Once', 'almuerzo': 'Almuerzo', 'mpm': 'Merienda tarde', 'cena': 'Cena', 'corroborar': 'Corroboración', 'post-comida': '2 Horas Post-Comida' };
  let html = ''; 
  let fechaAgrupada = ''; 
  const hOrd = historial.slice(); 
  
  hOrd.forEach(item => {
    const nom = item.tipoComida ? dict[item.tipoComida] : 'Manual'; 
    const partes = item.fecha.split(', '); 
    const dS = partes[0]; 
    const hS = partes || item.fecha;
    if (dS !== fechaAgrupada) { 
      fechaAgrupada = dS; 
      html += `<div class="historial-fecha-bloque">${dS}</div>`; 
    }
    let det = item.tipoComida === 'post-comida' ? `Medido: <span style="color: var(--turquoise-strong); font-weight:900;">${item.glucosa}</span>` : `Azúcar: ${item.glucosa || 0} | CHO: ${item.carbos || 0}g`;
    let dos = (item.tipoComida === 'post-comida') ? (item.dosis > 0 ? `<div style="color: var(--turquoise-strong); font-weight: 900; font-size: 20px;">${item.dosis} U</div>` : `<div style="color: var(--turquoise-strong); font-weight: 900; font-size: 16px;">Revisión</div>`) : `<div style="color: var(--text-dark); font-weight: 900; font-size: 20px;">${item.dosis} U</div>`;

    html += `<div class="historial-registro">
      <div style="width: 100%; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-size: 12px; font-weight: 800; color: var(--text-primary);">${hS} - <span style="color: var(--turquoise-strong);">${nom}</span></div>
          <div style="font-size: 13px; font-weight: 800; color: var(--text-primary); margin-top: 2px;">${det}</div>
        </div>
        <div style="text-align: right;">${dos}</div>
      </div>
    </div>`;
  });
  lista.innerHTML = html + `<p style="font-size: 13px; text-align:center; color: var(--text-primary); font-weight: 800; margin-top: 18px;">Historial clínico protegido.</p>`;
}

async function borrarHistorialCompleto() { 
  if(!confirm("⚠️ Alto líder. ¿Seguro que quieres borrar TODO el historial? Esta acción requiere confirmación de seguridad.")) return;
  const pin = prompt("🔒 Introduce el código PIN familiar para autorizar el borrado total:");
  if (pin !== "1234") { alert("❌ Código incorrecto. El historial está protegido."); return; }

  const hV = JSON.parse(localStorage.getItem('historial_polar') || '[]');
  const userId = localStorage.getItem('polar_user_id');

  if (userId) {
    const { error } = await polarDb
      .from('historial_polar')
      .delete()
      .eq('paciente_id', userId);

    if (error) {
      console.error("Error al borrar en la nube:", error);
      alert("Fallo en la conexión. No se pudo borrar de la nube.");
      return;
    }
  }

  localStorage.removeItem('historial_polar'); 
  actualizarVistaHistorial(); 
  renderGraficoPicos();
  actualizarRadar();
  activarDeshacer('historial', hV);
  alert("✅ Historial borrado.");
}

function sugerirEsquema() {
  const h = JSON.parse(localStorage.getItem('historial_polar') || '[]'); 
  if (h.length === 0) { alert("Registra datos primero, líder."); return; }
  const ah = new Date(); 
  const h2d = new Date(); 
  h2d.setDate(ah.getDate() - 2); 
  const ult = h.filter(i => { if (!i.iso) return false; return new Date(i.iso) >= h2d; });
  if (ult.length === 0) { alert("No hay mediciones en los últimos 2 días."); return; }
  let s = 0; let c = 0; 
  ult.forEach(r => { if (r.glucosa && r.glucosa > 0) { s += Number(r.glucosa); c++; } }); 
  if (c === 0) return;
  const p = s / c; 
  let m = "";
  if (p > 180) m = `Promedio ALTO (${p.toFixed(0)}).\n\nSugerencia: Liderazgo aquí. Aumenta Toujeo en 1 o 2 U o ajusta ratios y factores de corrección. Revisa con médico.`;
  else if (p < 80) m = `Promedio BAJO (${p.toFixed(0)}).\n\nSugerencia: Bajar Toujeo 1 o 2 U. Protege a la familia primero.`;
  else m = `Promedio EXCELENTE (${p.toFixed(0)}).\n\nSugerencia: Estás dominando al 100%. Mantén el esquema.`;
  alert(m);
}

// INSTANCIAS GLOBALES PARA GESTIÓN DE MEMORIA EN CHART.JS
let chartTendenciaInstancia = null;
let chartBarrasInstancia = null;
let chartDonutRangoInstancia = null;
let chartDonutAltaInstancia = null;
let chartDonutBajaInstancia = null;

// =========================================================================
// RENDERIZADO COMPLETO DEL PANEL ANALÍTICO ÉLITE (3 GRÁFICAS)
// =========================================================================
function renderGraficoPicos() {
  if (typeof Chart === 'undefined') {
    console.warn("Chart.js aún no está disponible.");
    return;
  }

  const canvasTendencia = document.getElementById('chartTendenciaHoras');
  if (!canvasTendencia) return;

  // 1. Extraer colores directos de las variables CSS activas del tema
  const styles = getComputedStyle(document.documentElement);
  const colorTurquesa = styles.getPropertyValue('--turquoise-strong').trim() || '#088387';
  const colorAzul = styles.getPropertyValue('--blue-ice-light').trim() || '#5B9BD5';
  const colorAmarillo = styles.getPropertyValue('--blue-ice-mid').trim() || '#F3C623';
  const colorRojo = styles.getPropertyValue('--accent-btn').trim() || '#F05A4A';
  const colorTexto = styles.getPropertyValue('--text-primary').trim() || '#2C3A40';

  // 2. Extraer datos del almacenamiento local de Polar
  const historial = JSON.parse(localStorage.getItem('historial_polar') || '[]');

  // =========================================================================
  // GRÁFICA 1: TENDENCIA HORARIA (Área / Línea con Puntos Marcados)
  // Regla estricta: Visible y precisa desde el 1er dato
  // =========================================================================
  const ctxTendencia = canvasTendencia.getContext('2d');
  if (chartTendenciaInstancia) chartTendenciaInstancia.destroy();

  const datosValidos = historial.filter(r => r.glucosa !== undefined && r.glucosa !== null && r.glucosa !== '');
  const ultimosRegistros = datosValidos.slice(-12);

  let labelsTendencia = [];
  let valoresGlucosa = [];
  let pointColors = [];

  if (ultimosRegistros.length === 0) {
    labelsTendencia = ['Sin registros'];
    valoresGlucosa = [100];
    pointColors = [colorTurquesa];
  } else {
    ultimosRegistros.forEach(item => {
      let hora = item.fecha ? (item.fecha.split(', ') || item.fecha.split(' ') || item.fecha) : '--:--';
      if (hora.length >= 5) hora = hora.substring(0, 5);
      labelsTendencia.push(hora);

      const val = parseFloat(item.glucosa) || 0;
      valoresGlucosa.push(val);

      if (val < 70) pointColors.push(colorRojo);
      else if (val > 180) pointColors.push(colorAmarillo);
      else pointColors.push(colorTurquesa);
    });
  }

  const gradientArea = ctxTendencia.createLinearGradient(0, 0, 0, 200);
  gradientArea.addColorStop(0, 'rgba(8, 131, 135, 0.28)');
  gradientArea.addColorStop(1, 'rgba(8, 131, 135, 0.00)');

  chartTendenciaInstancia = new Chart(ctxTendencia, {
    type: 'line',
    data: {
      labels: labelsTendencia,
      datasets: [{
        label: 'Glucosa (mg/dL)',
        data: valoresGlucosa,
        borderColor: colorTurquesa,
        borderWidth: 2.8,
        backgroundColor: gradientArea,
        fill: true,
        tension: 0.35,
        pointRadius: ultimosRegistros.length === 1 ? 8 : 5,
        pointHoverRadius: 7,
        pointBackgroundColor: pointColors,
        pointBorderColor: '#FFFFFF',
        pointBorderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: colorTexto,
          titleFont: { family: 'Nunito', weight: 'bold' },
          bodyFont: { family: 'Nunito', weight: 'bold' },
          callbacks: {
            label: (ctx) => ` Nivel: ${ctx.parsed.y} mg/dL`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: colorTexto, font: { family: 'Nunito', size: 10, weight: '700' } }
        },
        y: {
          suggestedMin: 50,
          suggestedMax: 250,
          grid: { color: 'rgba(44, 58, 64, 0.08)' },
          ticks: { color: colorTexto, font: { family: 'Nunito', size: 10, weight: '700' } }
        }
      }
    }
  });

  // =========================================================================
  // GRÁFICA 2: HISTÓRICO VERTICAL (Insulina vs Carbohidratos)
  // =========================================================================
  const canvasBarras = document.getElementById('chartBarrasRatios');
  if (canvasBarras) {
    const ctxBarras = canvasBarras.getContext('2d');
    if (chartBarrasInstancia) chartBarrasInstancia.destroy();

    const ultimosSiete = historial.slice(-7);
    const labelsBarras = ultimosSiete.map((item, idx) => {
      if (item.tipoComida) {
        const dict = { desayuno: 'Des', mam: 'Once', almuerzo: 'Alm', mpm: 'Mer', cena: 'Cen', corroborar: 'Rev' };
        return dict[item.tipoComida] || `C${idx + 1}`;
      }
      return `M${idx + 1}`;
    });

    const carbosData = ultimosSiete.map(item => parseFloat(item.carbos) || 0);
    const dosisData = ultimosSiete.map(item => parseFloat(item.dosis) || 0);

    chartBarrasInstancia = new Chart(ctxBarras, {
      type: 'bar',
      data: {
        labels: labelsBarras.length ? labelsBarras : ['Sin datos'],
        datasets: [
          {
            label: 'Carbos (g)',
            data: carbosData.length ? carbosData : [0],
            backgroundColor: colorAzul,
            borderRadius: 6,
            yAxisID: 'y'
          },
          {
            label: 'Dosis (U)',
            data: dosisData.length ? dosisData : [0],
            backgroundColor: colorTurquesa,
            borderRadius: 6,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { boxWidth: 12, color: colorTexto, font: { family: 'Nunito', weight: '800', size: 11 } }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: colorTexto, font: { family: 'Nunito', weight: '700', size: 10 } }
          },
          y: {
            type: 'linear',
            position: 'left',
            grid: { color: 'rgba(44, 58, 64, 0.08)' },
            ticks: { color: colorAzul, font: { family: 'Nunito', weight: '800', size: 10 } },
            title: { display: true, text: 'Gramos (CHO)', color: colorAzul, font: { size: 9, weight: '800' } }
          },
          y1: {
            type: 'linear',
            position: 'right',
            grid: { display: false },
            ticks: { color: colorTurquesa, font: { family: 'Nunito', weight: '800', size: 10 } },
            title: { display: true, text: 'Unidades (U)', color: colorTurquesa, font: { size: 9, weight: '800' } }
          }
        }
      }
    });
  }

  // =========================================================================
  // GRÁFICA 3: TRÍO DE DONUTS DE DISTRIBUCIÓN PORCENTUAL
  // =========================================================================
  let totalValidos = 0;
  let enRango = 0;
  let alta = 0;
  let baja = 0;

  historial.forEach(r => {
    const val = parseFloat(r.glucosa);
    if (!isNaN(val) && val > 0) {
      totalValidos++;
      if (val < 70) baja++;
      else if (val <= 180) enRango++;
      else alta++;
    }
  });

  const pRango = totalValidos ? Math.round((enRango / totalValidos) * 100) : 0;
  const pAlta = totalValidos ? Math.round((alta / totalValidos) * 100) : 0;
  const pBaja = totalValidos ? Math.round((baja / totalValidos) * 100) : 0;

  const lblRango = document.getElementById('donut-lbl-rango');
  const lblAlta = document.getElementById('donut-lbl-alta');
  const lblBaja = document.getElementById('donut-lbl-baja');
  if (lblRango) lblRango.innerText = `${pRango}%`;
  if (lblAlta) lblAlta.innerText = `${pAlta}%`;
  if (lblBaja) lblBaja.innerText = `${pBaja}%`;

  const configDonut = (ctxCanvas, porcentaje, colorPrimario) => {
    return new Chart(ctxCanvas, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [porcentaje, 100 - porcentaje],
          backgroundColor: [colorPrimario, 'rgba(44, 58, 64, 0.08)'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '74%',
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false }
        }
      }
    });
  };

  const canvasRango = document.getElementById('chartDonutRango');
  const canvasAlta = document.getElementById('chartDonutAlta');
  const canvasBaja = document.getElementById('chartDonutBaja');

  if (chartDonutRangoInstancia) chartDonutRangoInstancia.destroy();
  if (chartDonutAltaInstancia) chartDonutAltaInstancia.destroy();
  if (chartDonutBajaInstancia) chartDonutBajaInstancia.destroy();

  if (canvasRango) chartDonutRangoInstancia = configDonut(canvasRango.getContext('2d'), pRango, colorTurquesa);
  if (canvasAlta) chartDonutAltaInstancia = configDonut(canvasAlta.getContext('2d'), pAlta, colorAmarillo);
  if (canvasBaja) chartDonutBajaInstancia = configDonut(canvasBaja.getContext('2d'), pBaja, colorRojo);
}

function autoFocoCarbos() {
  const glucosaInput = document.getElementById('glucosa');
  if (glucosaInput.value.length >= 3) {
    document.getElementById('carbos').focus();
  }
}

function ciclarEjercicio() {
  estadoEjercicio = (estadoEjercicio + 1) % 3; 
  const btn = document.getElementById('btn-ejercicio'); 
  const input = document.getElementById('ejercicio');
  
  if (estadoEjercicio === 0) { 
      btn.innerText = "Tranquilo"; 
      btn.style.setProperty('background', '#4CAF50', 'important'); 
      btn.style.setProperty('color', '#FFFFFF', 'important'); 
      input.value = "1"; 
  } 
  else if (estadoEjercicio === 1) { 
      btn.innerText = "Un poco"; 
      btn.style.setProperty('background', '#FF9F0A', 'important'); 
      btn.style.setProperty('color', '#FFFFFF', 'important'); 
      input.value = "0.66"; 
  } 
  else { 
      btn.innerText = "Mucho"; 
      btn.style.setProperty('background', '#FF3B30', 'important'); 
      btn.style.setProperty('color', '#FFFFFF', 'important'); 
      input.value = "0.5"; 
  }
  dormirPolar(); 
  calcular(false);
}

function navegarCalculos(dir) {
  let nP = calcPosicion + dir;
  if (nP >= 0 && nP < calcHistoria.length) { 
      calcPosicion = nP; 
      let est = calcHistoria[calcPosicion]; 
      document.getElementById('glucosa').value = est.glucosa; 
      document.getElementById('carbos').value = est.carbos; 
      document.getElementById('comida').value = est.comida; 
      document.getElementById('meta').value = est.meta; 
      estadoEjercicio = est.estadoEjercicio - 1; 
      ciclarEjercicio(); 
      if(est.tendencia) { setTendencia(est.tendencia, true); } else { setTendencia('estable', true); }
  }
}

function calcular(esNav = false) {
  const glucosaInput = document.getElementById('glucosa').value; 
  const carbosInput = document.getElementById('carbos').value;
  const glucosa = parseFloat(glucosaInput) || 0; 
  const carbos = parseFloat(carbosInput) || 0;
  const comidaKey = document.getElementById('comida').value; 
  const metaRestar = parseFloat(document.getElementById('meta').value);
  const tendenciaVal = document.getElementById('tendencia') ? document.getElementById('tendencia').value : 'estable';

  if (glucosaInput === '' && carbosInput === '') {
      document.getElementById('resultado').style.display = 'none';
      return;
  }

  if (document.activeElement === document.getElementById('glucosa') && carbosInput === '' && comidaKey !== 'corroborar') {
      document.getElementById('resultado').style.display = 'none';
      return;
  }

  if (!esNav) { 
    const estA = { glucosa: glucosaInput, carbos: carbosInput, comida: comidaKey, meta: metaRestar, estadoEjercicio: estadoEjercicio, tendencia: tendenciaVal }; 
    calcHistoria = calcHistoria.slice(0, calcPosicion + 1); 
    calcHistoria.push(estA); 
    calcPosicion++; 
  }

  const inputRatio = document.getElementById('cfg-r-' + comidaKey);
  const ratio = inputRatio ? parseFloat(inputRatio.value) : (config.ratios[comidaKey] || 0);
  const factorEj = parseFloat(document.getElementById('ejercicio').value); 
  const fc = obtenerFcComida(comidaKey);
  const resDiv = document.getElementById('resultado');

  let dosisComidaExacta = (ratio === 0) ? 0 : (carbos / ratio);
  let dosisCorreccionExacta = (glucosa > metaRestar) ? (glucosa - metaRestar) / fc : 0; 

  let dosisTotalExacta = (dosisComidaExacta + dosisCorreccionExacta) * factorEj;

  let ajusteTendencia = "";
  if (tendenciaVal === 'bajando') {
      dosisTotalExacta = dosisTotalExacta * 0.8; 
      ajusteTendencia = "<br><span style='color:#FF3B30; font-weight:900;'>↓ Reducido 20% por caída rápida</span>";
  } else if (tendenciaVal === 'subiendo') {
      dosisTotalExacta = dosisTotalExacta * 1.1; 
      ajusteTendencia = "<br><span style='color:#FF9F0A; font-weight:900;'>↑ Aumentado 10% por subida rápida</span>";
  }

  if (glucosa <= 70 && glucosa > 54) { 
      dosisTotalExacta -= 2; 
  }
  if (dosisTotalExacta < 0) dosisTotalExacta = 0; 

  let dosisFinal = usoRedondeoElite ? redondeoElite(dosisTotalExacta) : Math.round(dosisTotalExacta * 10) / 10;
  let dosisComida = usoRedondeoElite ? redondeoElite(dosisComidaExacta) : Math.round(dosisComidaExacta * 10) / 10;
  let dosisCorreccion = usoRedondeoElite ? redondeoElite(dosisCorreccionExacta) : Math.round(dosisCorreccionExacta * 10) / 10;

  let protocoloClinicoHTML = "";
  let colorNumeroGemas = "var(--turquoise-strong)";

  if (glucosa > 0 && glucosa < 70) {
    colorNumeroGemas = "#FF3B30";
    protocoloClinicoHTML = `
      <div class="protocolo-box protocolo-alerta">
        <strong>• ¡Tu energía está bajita!</strong><br>
        <strong>Toma algo dulce YA:</strong> Bebe medio vaso de jugo o agua con 3 cucharaditas de azúcar.<br>
        <strong>Modo estatua:</strong> Siéntate y descansa. Cero correr o jugar.<br>
        <strong>Espera y revisa:</strong> Quédate tranquilo 15 minutos y vuelve a medirte.
      </div>`;
  } 
  else {
    if (glucosa >= 70 && glucosa <= 130) {
      protocoloClinicoHTML = `<div class="protocolo-box protocolo-normal">Estás en los valores recomendados.</div>`;
    }
    else if (glucosa >= 140 && glucosa <= 180) {
      protocoloClinicoHTML = `<div class="protocolo-box protocolo-normal">Un poquito alta. Bebe un vaso de agua.</div>`;
    }
    else if (glucosa >= 181 && glucosa <= 249) {
      protocoloClinicoHTML = `<div class="protocolo-box protocolo-normal">Aplica tu corrección. Toma agua pura.</div>`;
    }
    else if (glucosa >= 250 && glucosa < 400) {
      protocoloClinicoHTML = `<div class="protocolo-box protocolo-normal"><strong>• Actividad:</strong> Cero ejercicio.<br><strong>• Hidratación:</strong> Bebe medio litro de agua.</div>`;
    }
    else if (glucosa >= 400) {
      colorNumeroGemas = "#FF3B30";
      protocoloClinicoHTML = `<div class="protocolo-box protocolo-alerta"><strong>⚠️ Cifra crítica.</strong> Verifica tu catéter.</div>`;
    }
  }

  let btnAtras = `<button class="btn-small" onclick="navegarCalculos(-1)" ${calcPosicion <= 0 ? 'disabled' : ''}>Atrás</button>`; 
  let btnAdel = `<button class="btn-small" onclick="navegarCalculos(1)" ${calcPosicion >= calcHistoria.length - 1 ? 'disabled' : ''}>Adelante</button>`;

  resDiv.className = "result-box";
  resDiv.innerHTML = `
    <button class="btn-close-modal" onclick="document.getElementById('resultado').style.display='none'">×</button>
    <h2>¡Gemas Calculadas!</h2>
    <div class="result-number" style="color: ${colorNumeroGemas} !important;">${dosisFinal}</div>
    
    <button class="btn-save" style="background: var(--turquoise-strong); color: #FFFFFF; margin-top: 0px; margin-bottom: 8px; font-size: 14px; padding: 10px; border-radius: 12px; box-shadow: 0 6px 20px rgba(8,131,135,0.2);" 
    onpointerdown="guardarDosisAplicada(event, ${dosisFinal}, ${glucosa}, ${carbos}, '${comidaKey}')">Guardar Dosis</button>
    
    <div class="result-unit" style="margin-bottom: 4px;">Gemas Ultra para Polar</div>
    <div class="result-details" style="margin-top: 0px;">
      Por Comida: <strong>${dosisComida} U</strong> (R${ratio})<br>
      Por Energía: <strong>${dosisCorreccion} U</strong> (Ideal: ${metaRestar} | FC: ${fc})
      ${ajusteTendencia}
      ${protocoloClinicoHTML}
    </div>
    <div style="display: flex; justify-content: center; gap: 10px; margin-top: 12px;">
      ${btnAtras}${btnAdel}
    </div>`;
    
  resDiv.style.display = "block"; 
  despertarPolar(); 
}

if ('serviceWorker' in navigator) { 
  window.addEventListener('load', () => { 
    navigator.serviceWorker.register('./sw.js').catch(e => console.log('Error SW:', e)); 
  }); 
}

let startX = 0;
const panelMenu = document.getElementById('panel-menu');

panelMenu.addEventListener('touchstart', e => startX = e.touches[0].clientX);
panelMenu.addEventListener('touchmove', e => {
  if (startX - e.touches[0].clientX > 50) { 
    if (panelMenu.classList.contains('open')) toggleMenuPanel();
  }
});

panelMenu.addEventListener('mousedown', e => startX = e.clientX);
panelMenu.addEventListener('mousemove', e => {
  if (e.buttons === 1 && startX - e.clientX > 50) {
    if (panelMenu.classList.contains('open')) toggleMenuPanel();
  }
});
