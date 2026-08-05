(function () {
  'use strict';

  var LS_BACKEND_URL = 'far_backend_url';

  var state = {
    backendUrl: null,
    recetas: [],
    ingredientes: [],
    preparacion: [],
    recetaActual: null,
    marcados: {},
    pasoIndex: 0
  };

  var screens = ['loading', 'config', 'home', 'ingredientes', 'pasos', 'completado'];

  function showScreen(name) {
    screens.forEach(function (s) {
      document.getElementById('screen-' + s).classList.toggle('hidden', s !== name);
    });
  }

  function volverAlInicio() {
    state.recetaActual = null;
    state.marcados = {};
    state.pasoIndex = 0;
    showScreen('home');
  }

  // ---------- Configuración inicial ----------

  function initConfigScreen() {
    var input = document.getElementById('input-backend-url');
    var error = document.getElementById('config-error');
    document.getElementById('btn-guardar-url').addEventListener('click', function () {
      var url = input.value.trim();
      if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(url)) {
        error.textContent = 'La URL no parece válida. Debe verse como https://script.google.com/macros/s/AAAA.../exec';
        error.classList.remove('hidden');
        return;
      }
      localStorage.setItem(LS_BACKEND_URL, url);
      state.backendUrl = url;
      error.classList.add('hidden');
      arrancar();
    });
  }

  // ---------- Carga de datos ----------

  function fetchDatos() {
    return fetch(state.backendUrl)
      .then(function (res) { return res.json(); })
      .then(function (data) {
        state.recetas = data.recetas || [];
        state.ingredientes = data.ingredientes || [];
        state.preparacion = data.preparacion || [];
      });
  }

  function arrancar() {
    showScreen('loading');
    fetchDatos()
      .then(function () {
        initHomeScreen();
        showScreen('home');
      })
      .catch(function (err) {
        console.error('Error cargando el recetario', err);
        showScreen('config');
        var error = document.getElementById('config-error');
        error.textContent = 'No se pudo conectar con el backend. Revisa la URL e intenta de nuevo.';
        error.classList.remove('hidden');
      });
  }

  // ---------- Pantalla inicial: buscador + filtro + lista ----------

  var filtroCategoria = '';
  var homeInitialized = false;

  function initHomeScreen() {
    renderListaRecetas();
    if (homeInitialized) return;
    homeInitialized = true;

    document.getElementById('input-buscar').addEventListener('input', renderListaRecetas);

    document.querySelectorAll('.filtro-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.filtro-btn').forEach(function (b) { b.classList.remove('selected'); });
        btn.classList.add('selected');
        filtroCategoria = btn.getAttribute('data-categoria');
        renderListaRecetas();
      });
    });
  }

  function renderListaRecetas() {
    var termino = document.getElementById('input-buscar').value.trim().toLowerCase();
    var contenedor = document.getElementById('lista-recetas');
    var vacio = document.getElementById('home-vacio');
    contenedor.innerHTML = '';

    var filtradas = state.recetas.filter(function (r) {
      var coincideTexto = !termino || (r.nombre || '').toLowerCase().indexOf(termino) !== -1;
      var coincideCategoria = !filtroCategoria || r.categoria === filtroCategoria;
      return coincideTexto && coincideCategoria;
    });

    vacio.classList.toggle('hidden', filtradas.length > 0);

    filtradas.forEach(function (r) {
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'receta-card';
      card.innerHTML =
        '<div class="receta-card__nombre">' + escapeHtml(r.nombre) + '</div>' +
        '<div class="receta-card__meta">' + escapeHtml(r.porciones || '') + (r.tiempo_prep ? ' · ' + escapeHtml(r.tiempo_prep) : '') + '</div>' +
        '<div class="receta-card__categoria">' + escapeHtml(r.categoria || '') + '</div>';
      card.addEventListener('click', function () {
        abrirReceta(r);
      });
      contenedor.appendChild(card);
    });
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = String(str == null ? '' : str);
    return div.innerHTML;
  }

  // ---------- Vista de ingredientes ----------

  function abrirReceta(receta) {
    state.recetaActual = receta;
    state.marcados = {};
    state.pasoIndex = 0;
    renderIngredientes();
    showScreen('ingredientes');
  }

  function renderIngredientes() {
    var receta = state.recetaActual;
    document.getElementById('ingredientes-titulo').textContent = receta.nombre;
    document.getElementById('ingredientes-meta').textContent =
      (receta.porciones || '') + (receta.tiempo_prep ? ' · ' + receta.tiempo_prep : '');
    document.getElementById('ingredientes-notas').textContent = receta.notas || '';
    document.getElementById('ingredientes-notas').classList.toggle('hidden', !receta.notas);

    var lista = state.ingredientes.filter(function (i) { return i.receta_id === receta.receta_id; });
    var contenedor = document.getElementById('lista-ingredientes');
    contenedor.innerHTML = '';

    lista.forEach(function (ing, idx) {
      var item = document.createElement('label');
      item.className = 'ingrediente-item';
      var checkboxId = 'ing-' + idx;
      item.innerHTML =
        '<input type="checkbox" id="' + checkboxId + '">' +
        '<span class="ingrediente-item__texto">' +
        '<span class="ingrediente-item__nombre">' + escapeHtml(ing.ingrediente) + '</span><br>' +
        '<span class="ingrediente-item__cantidad">' + escapeHtml(ing.cantidad) + ' ' + escapeHtml(ing.unidad) + '</span>' +
        '</span>';
      var checkbox = item.querySelector('input');
      checkbox.checked = !!state.marcados[idx];
      checkbox.addEventListener('change', function () {
        state.marcados[idx] = checkbox.checked;
        item.classList.toggle('marcado', checkbox.checked);
      });
      item.classList.toggle('marcado', checkbox.checked);
      contenedor.appendChild(item);
    });
  }

  // ---------- Vista de pasos (wizard) ----------

  function comenzarPreparacion() {
    state.pasoIndex = 0;
    renderPaso();
    showScreen('pasos');
  }

  function pasosDeRecetaActual() {
    var receta = state.recetaActual;
    return state.preparacion
      .filter(function (p) { return p.receta_id === receta.receta_id; })
      .sort(function (a, b) { return Number(a.paso_num) - Number(b.paso_num); });
  }

  function renderPaso() {
    var pasos = pasosDeRecetaActual();
    var total = pasos.length;
    var paso = pasos[state.pasoIndex];

    document.getElementById('pasos-titulo').textContent = state.recetaActual.nombre;

    var pct = total ? Math.round(((state.pasoIndex + 1) / total) * 100) : 0;
    document.getElementById('pasos-progress-fill').style.width = pct + '%';
    document.getElementById('pasos-progress-text').textContent = 'Paso ' + (state.pasoIndex + 1) + ' de ' + total;

    var contenido = document.getElementById('paso-contenido');
    contenido.innerHTML =
      '<div class="paso-numero">Paso ' + (state.pasoIndex + 1) + ' de ' + total + '</div>' +
      '<div class="paso-instruccion">' + escapeHtml(paso ? paso.instruccion : '') + '</div>';

    var btnAnterior = document.getElementById('btn-paso-anterior');
    var btnSiguiente = document.getElementById('btn-paso-siguiente');
    btnAnterior.disabled = state.pasoIndex === 0;
    btnSiguiente.textContent = (state.pasoIndex === total - 1) ? 'Completar' : 'Siguiente';
  }

  function irPasoAnterior() {
    if (state.pasoIndex === 0) return;
    state.pasoIndex--;
    renderPaso();
  }

  function irPasoSiguiente() {
    var pasos = pasosDeRecetaActual();
    if (state.pasoIndex === pasos.length - 1) {
      document.getElementById('completado-nombre').textContent =
        'Terminaste la preparación de "' + state.recetaActual.nombre + '".';
      showScreen('completado');
      return;
    }
    state.pasoIndex++;
    renderPaso();
  }

  // ---------- Arranque ----------

  document.addEventListener('DOMContentLoaded', function () {
    initConfigScreen();

    document.getElementById('btn-comenzar-preparacion').addEventListener('click', comenzarPreparacion);
    document.getElementById('btn-paso-anterior').addEventListener('click', irPasoAnterior);
    document.getElementById('btn-paso-siguiente').addEventListener('click', irPasoSiguiente);
    document.getElementById('btn-volver-ingredientes').addEventListener('click', volverAlInicio);
    document.getElementById('btn-volver-pasos').addEventListener('click', volverAlInicio);
    document.getElementById('btn-volver-inicio').addEventListener('click', volverAlInicio);

    state.backendUrl = localStorage.getItem(LS_BACKEND_URL);
    if (!state.backendUrl) {
      showScreen('config');
      return;
    }
    arrancar();
  });
})();
