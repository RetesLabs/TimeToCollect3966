// =============================================================================
// Code.gs — Google Apps Script backend for Condominium Payment Management
// Spreadsheet: 3 sheets (Departamentos, Cobros, Pagos)
// Exposes a JSON API through doGet / doPost web-app endpoints.
// =============================================================================

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
// ⚠️ IMPORTANT: Set your Google Spreadsheet ID here.
// Find it in the URL: https://docs.google.com/spreadsheets/d/YOUR_ID_HERE/edit
var SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || '';

var SHEET_DEPTOS = 'Departamentos';
var SHEET_COBROS = 'Cobros';
var SHEET_PAGOS  = 'Pagos';
var DRIVE_FOLDER_NAME = 'Comprobantes3966';

// ---------------------------------------------------------------------------
// Web-app entry points
// ---------------------------------------------------------------------------

/**
 * Handle GET requests.
 * Expects e.parameter.action to route to the correct handler.
 */
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : '';
  var result;

  try {
    switch (action) {
      case 'getDepartamentos':
        result = getDepartamentos();
        break;
      case 'getCobroActual':
        result = getCobroActual();
        break;
      case 'getHistorico':
        result = getHistorico();
        break;
      default:
        result = { success: false, error: 'Accion GET no reconocida: ' + action };
    }
  } catch (err) {
    result = { success: false, error: err.message };
  }

  return jsonResponse(result);
}

/**
 * Handle POST requests.
 * Expects JSON body with an "action" field to route to the correct handler.
 */
function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse({ success: false, error: 'JSON invalido en el cuerpo de la solicitud.' });
  }

  var action = body.action || '';
  var result;

  try {
    switch (action) {
      case 'login':
        result = login(body);
        break;
      case 'crearCobro':
        result = requireAdmin(body, function () { return crearCobro(body); });
        break;
      case 'registrarPago':
        result = requireAdmin(body, function () { return registrarPago(body); });
        break;
      case 'actualizarDepto':
        result = requireAdmin(body, function () { return actualizarDepto(body); });
        break;
      case 'subirComprobante':
        result = subirComprobante(body);
        break;
      default:
        result = { success: false, error: 'Accion POST no reconocida: ' + action };
    }
  } catch (err) {
    result = { success: false, error: err.message };
  }

  return jsonResponse(result);
}

// ---------------------------------------------------------------------------
// JSON response helper
// ---------------------------------------------------------------------------

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/**
 * Validate the admin password from the request body against the stored property.
 */
function validatePassword(password) {
  var stored = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  if (!stored) {
    throw new Error('ADMIN_PASSWORD no esta configurada. Ejecuta setup() primero.');
  }
  return password === stored;
}

/**
 * Middleware-style guard: runs the callback only if the password in the body is valid.
 */
function requireAdmin(body, callback) {
  if (!body.password) {
    return { success: false, error: 'Se requiere el campo password.' };
  }
  if (!validatePassword(body.password)) {
    return { success: false, error: 'Contrasena incorrecta.' };
  }
  return callback();
}

// ---------------------------------------------------------------------------
// Sheet helpers
// ---------------------------------------------------------------------------

function getSpreadsheet() {
  if (SPREADSHEET_ID) {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  // Fallback for when running directly from the script editor bound to a sheet
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('No se pudo abrir la hoja de calculo. Configura SPREADSHEET_ID en Script Properties.');
  }
  return ss;
}

function getSheet(name) {
  var sheet = getSpreadsheet().getSheetByName(name);
  if (!sheet) {
    throw new Error('Hoja "' + name + '" no encontrada. Ejecuta setup() primero.');
  }
  return sheet;
}

/**
 * Read all rows from a sheet and return an array of objects keyed by the header row.
 */
function sheetToObjects(sheetName) {
  var sheet = getSheet(sheetName);
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  var headers = data[0];
  var objects = [];
  for (var i = 1; i < data.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = data[i][j];
    }
    objects.push(obj);
  }
  return objects;
}

/**
 * Append a row to a sheet.  `values` is an array matching the column order.
 */
function appendRow(sheetName, values) {
  var sheet = getSheet(sheetName);
  sheet.appendRow(values);
}

/**
 * Find the row index (1-based) of the first row where column `colIndex` (0-based) equals `value`.
 * Returns -1 if not found.  Skips the header row.
 */
function findRowIndex(sheetName, colIndex, value) {
  var sheet = getSheet(sheetName);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][colIndex]) === String(value)) {
      return i + 1; // 1-based row number
    }
  }
  return -1;
}

/**
 * Find all row indices (1-based) where column `colIndex` (0-based) equals `value`.
 */
function findAllRowIndices(sheetName, colIndex, value) {
  var sheet = getSheet(sheetName);
  var data = sheet.getDataRange().getValues();
  var indices = [];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][colIndex]) === String(value)) {
      indices.push(i + 1);
    }
  }
  return indices;
}

// ---------------------------------------------------------------------------
// 1. getDepartamentos (GET)
// ---------------------------------------------------------------------------

function getDepartamentos() {
  var deptos = sheetToObjects(SHEET_DEPTOS);
  return { success: true, data: deptos };
}

// ---------------------------------------------------------------------------
// 2. getCobroActual (GET)
// ---------------------------------------------------------------------------

/**
 * Return the cobro for the current calendar month (YYYY-MM) together with
 * per-departamento payment status.
 */
function getCobroActual() {
  var now = new Date();
  var mesActual = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM');

  var cobros = sheetToObjects(SHEET_COBROS);
  var cobroActual = null;
  for (var i = 0; i < cobros.length; i++) {
    if (String(cobros[i].mes) === mesActual) {
      cobroActual = cobros[i];
      break;
    }
  }

  if (!cobroActual) {
    return { success: true, data: null, message: 'No hay cobro registrado para el mes actual (' + mesActual + ').' };
  }

  var pagos = sheetToObjects(SHEET_PAGOS);
  var deptos = sheetToObjects(SHEET_DEPTOS);

  // Index pagos by depto for this cobro
  var pagosPorDepto = {};
  for (var p = 0; p < pagos.length; p++) {
    if (String(pagos[p].cobroId) === String(cobroActual.id)) {
      pagosPorDepto[String(pagos[p].depto)] = pagos[p];
    }
  }

  var detalle = [];
  for (var d = 0; d < deptos.length; d++) {
    var deptoKey = String(deptos[d].depto);
    var pago = pagosPorDepto[deptoKey] || null;
    detalle.push({
      depto: deptos[d].depto,
      nombre: deptos[d].nombre,
      telefono: deptos[d].telefono,
      activo: deptos[d].activo,
      saldoFavor: deptos[d].saldoFavor,
      montoPagado: pago ? pago.montoPagado : 0,
      montoAdeudo: pago ? pago.montoAdeudo : cobroActual.montoBase,
      saldoFavorUsado: pago ? pago.saldoFavorUsado : 0,
      fechaPago: pago ? pago.fechaPago : '',
      comprobante: pago ? pago.comprobante : '',
      status: pago ? pago.status : 'pendiente'
    });
  }

  return {
    success: true,
    data: {
      id: cobroActual.id,
      mes: cobroActual.mes,
      montoBase: cobroActual.montoBase,
      fechaCreacion: cobroActual.fechaCreacion,
      departamentos: detalle
    }
  };
}

// ---------------------------------------------------------------------------
// 3. getHistorico (GET)
// ---------------------------------------------------------------------------

/**
 * Return every cobro with its associated pagos grouped by cobroId.
 */
function getHistorico() {
  var cobros = sheetToObjects(SHEET_COBROS);
  var pagos  = sheetToObjects(SHEET_PAGOS);

  // Index pagos by cobroId
  var pagosMap = {};
  for (var p = 0; p < pagos.length; p++) {
    var cid = String(pagos[p].cobroId);
    if (!pagosMap[cid]) {
      pagosMap[cid] = [];
    }
    pagosMap[cid].push(pagos[p]);
  }

  var historico = [];
  for (var c = 0; c < cobros.length; c++) {
    var cobro = cobros[c];
    historico.push({
      id: cobro.id,
      mes: cobro.mes,
      montoBase: cobro.montoBase,
      fechaCreacion: cobro.fechaCreacion,
      pagos: pagosMap[String(cobro.id)] || []
    });
  }

  // Sort newest first
  historico.sort(function (a, b) {
    return String(b.mes).localeCompare(String(a.mes));
  });

  return { success: true, data: historico };
}

// ---------------------------------------------------------------------------
// 4. crearCobro (POST — Admin)
// ---------------------------------------------------------------------------

/**
 * Create a new monthly cobro.
 * Body params: mes (YYYY-MM), montoBase (number).
 */
function crearCobro(body) {
  var mes = body.mes;
  var montoBase = parseFloat(body.montoBase);

  if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
    return { success: false, error: 'Formato de mes invalido. Usa YYYY-MM.' };
  }
  if (isNaN(montoBase) || montoBase <= 0) {
    return { success: false, error: 'montoBase debe ser un numero positivo.' };
  }

  // Prevent duplicate cobro for the same month
  var cobros = sheetToObjects(SHEET_COBROS);
  for (var i = 0; i < cobros.length; i++) {
    if (String(cobros[i].mes) === mes) {
      return { success: false, error: 'Ya existe un cobro para el mes ' + mes + '.' };
    }
  }

  var id = Utilities.getUuid();
  var fechaCreacion = new Date().toISOString();

  appendRow(SHEET_COBROS, [id, mes, montoBase, fechaCreacion]);

  return {
    success: true,
    data: { id: id, mes: mes, montoBase: montoBase, fechaCreacion: fechaCreacion }
  };
}

// ---------------------------------------------------------------------------
// 5. registrarPago (POST — Admin)
// ---------------------------------------------------------------------------

/**
 * Register (or update) a payment for a departamento on a specific cobro.
 * Body params: cobroId, depto, montoPagado, montoAdeudo, saldoFavorUsado.
 * Optional: status ("pagado" | "adelanto"), defaults to "pagado".
 *
 * Also updates the depto's saldoFavor in the Departamentos sheet:
 *   newSaldoFavor = previousSaldoFavor - saldoFavorUsado + (montoPagado - montoBase + saldoFavorUsado > 0 ? overpayment : 0)
 *   Simplified: if montoPagado > montoBase - saldoFavorUsado then the excess becomes new saldoFavor.
 */
function registrarPago(body) {
  var cobroId        = body.cobroId;
  var depto          = body.depto;
  var montoPagado    = parseFloat(body.montoPagado) || 0;
  var montoAdeudo    = parseFloat(body.montoAdeudo) || 0;
  var saldoFavorUsado = parseFloat(body.saldoFavorUsado) || 0;
  var status         = body.status || 'pagado';

  if (!cobroId || depto === undefined || depto === null || depto === '') {
    return { success: false, error: 'cobroId y depto son obligatorios.' };
  }

  if (status !== 'pagado' && status !== 'adelanto') {
    return { success: false, error: 'status debe ser "pagado" o "adelanto".' };
  }

  // Validate cobro exists
  var cobroRow = findRowIndex(SHEET_COBROS, 0, cobroId);
  if (cobroRow === -1) {
    return { success: false, error: 'Cobro no encontrado: ' + cobroId };
  }

  // Validate depto exists
  var deptoSheet = getSheet(SHEET_DEPTOS);
  var deptoData = deptoSheet.getDataRange().getValues();
  var deptoRowIndex = -1;
  for (var d = 1; d < deptoData.length; d++) {
    if (String(deptoData[d][0]) === String(depto)) {
      deptoRowIndex = d + 1; // 1-based
      break;
    }
  }
  if (deptoRowIndex === -1) {
    return { success: false, error: 'Departamento no encontrado: ' + depto };
  }

  var fechaPago = new Date().toISOString();

  // Check if a pago already exists for this cobro + depto — if so, update it
  var pagosSheet = getSheet(SHEET_PAGOS);
  var pagosData = pagosSheet.getDataRange().getValues();
  var existingPagoRow = -1;
  for (var p = 1; p < pagosData.length; p++) {
    if (String(pagosData[p][1]) === String(cobroId) && String(pagosData[p][2]) === String(depto)) {
      existingPagoRow = p + 1; // 1-based
      break;
    }
  }

  var pagoId;
  if (existingPagoRow !== -1) {
    // Update existing pago row (keep existing id and comprobante)
    pagoId = pagosData[existingPagoRow - 1][0]; // preserve existing ID (array is 0-based)
    var existingComprobante = pagosData[existingPagoRow - 1][7]; // column H = comprobante
    pagosSheet.getRange(existingPagoRow, 1, 1, 9).setValues([[
      pagoId,
      cobroId,
      depto,
      montoPagado,
      montoAdeudo,
      saldoFavorUsado,
      fechaPago,
      existingComprobante,
      status
    ]]);
  } else {
    // Create new pago
    pagoId = Utilities.getUuid();
    appendRow(SHEET_PAGOS, [
      pagoId,
      cobroId,
      depto,
      montoPagado,
      montoAdeudo,
      saldoFavorUsado,
      fechaPago,
      '',   // comprobante — empty until uploaded
      status
    ]);
  }

  // Update saldoFavor on the Departamentos sheet
  // saldoFavor column is index 4 (0-based) = column E
  var currentSaldoFavor = parseFloat(deptoData[deptoRowIndex - 1][4]) || 0;
  var newSaldoFavor = currentSaldoFavor - saldoFavorUsado;

  // If there is overpayment (montoPagado covers more than what was owed), add it as saldoFavor
  var cobrosData = getSheet(SHEET_COBROS).getDataRange().getValues();
  var montoBase = 0;
  for (var c = 1; c < cobrosData.length; c++) {
    if (String(cobrosData[c][0]) === String(cobroId)) {
      montoBase = parseFloat(cobrosData[c][2]) || 0;
      break;
    }
  }

  var totalCubierto = montoPagado + saldoFavorUsado;
  if (totalCubierto > montoBase) {
    newSaldoFavor += (totalCubierto - montoBase);
  }

  if (newSaldoFavor < 0) newSaldoFavor = 0;

  deptoSheet.getRange(deptoRowIndex, 5).setValue(newSaldoFavor); // column E = saldoFavor

  return {
    success: true,
    data: {
      pagoId: pagoId,
      cobroId: cobroId,
      depto: depto,
      montoPagado: montoPagado,
      montoAdeudo: montoAdeudo,
      saldoFavorUsado: saldoFavorUsado,
      fechaPago: fechaPago,
      status: status,
      nuevoSaldoFavor: newSaldoFavor
    }
  };
}

// ---------------------------------------------------------------------------
// 6. actualizarDepto (POST — Admin)
// ---------------------------------------------------------------------------

/**
 * Update a departamento's resident info.
 * Body params: depto (identifier — cannot change), nombre, telefono, activo.
 */
function actualizarDepto(body) {
  var depto = body.depto;
  if (depto === undefined || depto === null || depto === '') {
    return { success: false, error: 'El campo depto es obligatorio.' };
  }

  var sheet = getSheet(SHEET_DEPTOS);
  var data = sheet.getDataRange().getValues();
  var rowIndex = -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(depto)) {
      rowIndex = i + 1; // 1-based
      break;
    }
  }

  if (rowIndex === -1) {
    return { success: false, error: 'Departamento no encontrado: ' + depto };
  }

  // Only update fields that are provided
  if (body.nombre !== undefined) {
    sheet.getRange(rowIndex, 2).setValue(body.nombre);       // column B
  }
  if (body.telefono !== undefined) {
    sheet.getRange(rowIndex, 3).setValue(body.telefono);     // column C
  }
  if (body.activo !== undefined) {
    sheet.getRange(rowIndex, 4).setValue(body.activo);       // column D
  }

  // Re-read the updated row
  var updatedRow = sheet.getRange(rowIndex, 1, 1, 5).getValues()[0];
  return {
    success: true,
    data: {
      depto: updatedRow[0],
      nombre: updatedRow[1],
      telefono: updatedRow[2],
      activo: updatedRow[3],
      saldoFavor: updatedRow[4]
    }
  };
}

// ---------------------------------------------------------------------------
// 7. subirComprobante (POST — Public)
// ---------------------------------------------------------------------------

/**
 * Upload a proof-of-payment image (base64) to Google Drive and store the URL
 * in the corresponding Pagos row.
 * Body params: cobroId, depto, fileData (base64 string), fileName.
 */
function subirComprobante(body) {
  var cobroId  = body.cobroId;
  var depto    = body.depto;
  var fileData = body.fileData;
  var fileName = body.fileName;

  if (!cobroId || depto === undefined || depto === null || depto === '') {
    return { success: false, error: 'cobroId y depto son obligatorios.' };
  }
  if (!fileData || !fileName) {
    return { success: false, error: 'fileData y fileName son obligatorios.' };
  }

  // Find or create pago row for this cobro + depto
  var pagosSheet = getSheet(SHEET_PAGOS);
  var pagosData = pagosSheet.getDataRange().getValues();
  var pagoRowIndex = -1;
  for (var p = 1; p < pagosData.length; p++) {
    if (String(pagosData[p][1]) === String(cobroId) && String(pagosData[p][2]) === String(depto)) {
      pagoRowIndex = p + 1; // 1-based
      break;
    }
  }

  if (pagoRowIndex === -1) {
    // Create a placeholder pago row so the comprobante has somewhere to live
    var pagoId = Utilities.getUuid();
    var cobrosObjs = sheetToObjects(SHEET_COBROS);
    var montoBase = 0;
    for (var c = 0; c < cobrosObjs.length; c++) {
      if (String(cobrosObjs[c].id) === String(cobroId)) {
        montoBase = parseFloat(cobrosObjs[c].montoBase) || 0;
        break;
      }
    }
    appendRow(SHEET_PAGOS, [
      pagoId,
      cobroId,
      depto,
      0,          // montoPagado
      montoBase,  // montoAdeudo
      0,          // saldoFavorUsado
      '',         // fechaPago
      '',         // comprobante — will be set below
      'pendiente' // status
    ]);
    // Re-read to find the new row
    pagosData = pagosSheet.getDataRange().getValues();
    for (var q = 1; q < pagosData.length; q++) {
      if (String(pagosData[q][1]) === String(cobroId) && String(pagosData[q][2]) === String(depto)) {
        pagoRowIndex = q + 1;
        break;
      }
    }
  }

  // Decode base64 and save to Drive
  var blob;
  try {
    var decoded = Utilities.base64Decode(fileData);
    blob = Utilities.newBlob(decoded, getMimeType(fileName), fileName);
  } catch (err) {
    return { success: false, error: 'Error al decodificar el archivo: ' + err.message };
  }

  var folder = getOrCreateDriveFolder(DRIVE_FOLDER_NAME);
  var uniqueName = depto + '_' + cobroId.substring(0, 8) + '_' + fileName;
  blob.setName(uniqueName);
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  var fileUrl = file.getUrl();

  // Write URL into the comprobante column (column H = index 8, 1-based)
  pagosSheet.getRange(pagoRowIndex, 8).setValue(fileUrl);

  return {
    success: true,
    data: {
      comprobanteUrl: fileUrl,
      cobroId: cobroId,
      depto: depto
    }
  };
}

/**
 * Infer MIME type from file extension.
 */
function getMimeType(fileName) {
  var ext = (fileName || '').split('.').pop().toLowerCase();
  var mimeTypes = {
    'png':  'image/png',
    'jpg':  'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif':  'image/gif',
    'webp': 'image/webp',
    'pdf':  'application/pdf',
    'bmp':  'image/bmp'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Get an existing Drive folder by name or create it.
 */
function getOrCreateDriveFolder(folderName) {
  var folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(folderName);
}

// ---------------------------------------------------------------------------
// 8. login (POST)
// ---------------------------------------------------------------------------

/**
 * Validate the admin password.
 * Body params: password.
 */
function login(body) {
  if (!body.password) {
    return { success: false, error: 'Se requiere el campo password.' };
  }
  if (validatePassword(body.password)) {
    return { success: true, message: 'Autenticacion exitosa.' };
  }
  return { success: false, error: 'Contrasena incorrecta.' };
}

// ---------------------------------------------------------------------------
// Setup — run once from the script editor
// ---------------------------------------------------------------------------

/**
 * Creates the three required sheets with their header rows and sets a default
 * admin password in Script Properties.
 *
 * Safe to run multiple times — it will skip sheets that already exist.
 */
function setup() {
  var ss = getSpreadsheet();

  // -- Departamentos --
  var deptoSheet = ss.getSheetByName(SHEET_DEPTOS);
  if (!deptoSheet) {
    deptoSheet = ss.insertSheet(SHEET_DEPTOS);
    deptoSheet.appendRow(['depto', 'nombre', 'telefono', 'activo', 'saldoFavor']);
    deptoSheet.getRange(1, 1, 1, 5).setFontWeight('bold');
  }

  // -- Cobros --
  var cobrosSheet = ss.getSheetByName(SHEET_COBROS);
  if (!cobrosSheet) {
    cobrosSheet = ss.insertSheet(SHEET_COBROS);
    cobrosSheet.appendRow(['id', 'mes', 'montoBase', 'fechaCreacion']);
    cobrosSheet.getRange(1, 1, 1, 4).setFontWeight('bold');
  }

  // -- Pagos --
  var pagosSheet = ss.getSheetByName(SHEET_PAGOS);
  if (!pagosSheet) {
    pagosSheet = ss.insertSheet(SHEET_PAGOS);
    pagosSheet.appendRow(['id', 'cobroId', 'depto', 'montoPagado', 'montoAdeudo', 'saldoFavorUsado', 'fechaPago', 'comprobante', 'status']);
    pagosSheet.getRange(1, 1, 1, 9).setFontWeight('bold');
  }

  // -- Admin password --
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('ADMIN_PASSWORD')) {
    props.setProperty('ADMIN_PASSWORD', 'admin3966');
    Logger.log('ADMIN_PASSWORD establecida por defecto: admin3966  — cambiala cuanto antes.');
  } else {
    Logger.log('ADMIN_PASSWORD ya existe; no se modifico.');
  }

  Logger.log('Setup completado.');
}

// ---------------------------------------------------------------------------
// Seed Data — run once from the script editor to populate with sample data
// ---------------------------------------------------------------------------

/**
 * Populate the spreadsheet with comprehensive sample data for testing.
 * - 12 departments (depto 9 inactive, rest active, fictitious names)
 * - 4 cobros: Dec 2025, Jan 2026, Feb 2026, Mar 2026 (montoBase $350)
 * - Varied payments across months (paid, advance, partial, pending)
 * - Accumulated saldoFavor for deptos with overpayment
 *
 * Idempotent: only inserts if the Departamentos sheet is empty (header only).
 */
function seedData() {
  // Ensure sheets exist
  setup();

  var deptoSheet = getSheet(SHEET_DEPTOS);
  var deptoData = deptoSheet.getDataRange().getValues();

  // Only seed if Departamentos has no data rows (just header)
  if (deptoData.length > 1) {
    Logger.log('seedData: La hoja Departamentos ya tiene datos. No se insertaron datos de ejemplo.');
    return;
  }

  var tz = Session.getScriptTimeZone();
  var montoBase = 350;

  // --- 1. Insert 12 departments ---
  var departamentos = [
    [1,  'Ana García',       '5551234001', true,  0],
    [2,  'Luis Hernández',   '5551234002', true,  0],
    [3,  'María López',      '5551234003', true,  0],
    [4,  'Carlos Martínez',  '5551234004', true,  0],
    [5,  'Rosa Díaz',        '5551234005', true,  0],
    [6,  'Jorge Ramírez',    '5551234006', true,  0],
    [7,  'Patricia Flores',  '5551234007', true,  0],
    [8,  'Fernando Torres',  '5551234008', true,  0],
    [9,  'Elena Morales',    '5551234009', false, 0],
    [10, 'Ricardo Vargas',   '5551234010', true,  0],
    [11, 'Sofía Castro',     '5551234011', true,  0],
    [12, 'Miguel Ortega',    '5551234012', true,  0],
  ];

  for (var d = 0; d < departamentos.length; d++) {
    deptoSheet.appendRow(departamentos[d]);
  }
  Logger.log('seedData: 12 departamentos insertados.');

  // --- 2. Create 4 months of cobros ---
  var meses = [
    { mes: '2025-12', fecha: new Date(2025, 11, 1) },
    { mes: '2026-01', fecha: new Date(2026, 0, 1) },
    { mes: '2026-02', fecha: new Date(2026, 1, 1) },
    { mes: '2026-03', fecha: new Date(2026, 2, 1) },
  ];

  var cobroIds = {};
  for (var m = 0; m < meses.length; m++) {
    var id = Utilities.getUuid();
    cobroIds[meses[m].mes] = id;
    appendRow(SHEET_COBROS, [id, meses[m].mes, montoBase, meses[m].fecha.toISOString()]);
  }
  Logger.log('seedData: 4 cobros creados (2025-12 a 2026-03).');

  // --- 3. Payments per month ---
  // Dec 2025 — All active deptos paid (complete month)
  var pagosDic = [
    { depto: 1,  montoPagado: 350, montoAdeudo: 0, sfUsado: 0, status: 'pagado' },
    { depto: 2,  montoPagado: 350, montoAdeudo: 0, sfUsado: 0, status: 'pagado' },
    { depto: 3,  montoPagado: 350, montoAdeudo: 0, sfUsado: 0, status: 'pagado' },
    { depto: 4,  montoPagado: 350, montoAdeudo: 0, sfUsado: 0, status: 'pagado' },
    { depto: 5,  montoPagado: 350, montoAdeudo: 0, sfUsado: 0, status: 'pagado' },
    { depto: 6,  montoPagado: 350, montoAdeudo: 0, sfUsado: 0, status: 'pagado' },
    { depto: 7,  montoPagado: 350, montoAdeudo: 0, sfUsado: 0, status: 'pagado' },
    { depto: 8,  montoPagado: 350, montoAdeudo: 0, sfUsado: 0, status: 'pagado' },
    // depto 9 inactive — no payment
    { depto: 10, montoPagado: 350, montoAdeudo: 0, sfUsado: 0, status: 'pagado' },
    { depto: 11, montoPagado: 350, montoAdeudo: 0, sfUsado: 0, status: 'pagado' },
    { depto: 12, montoPagado: 350, montoAdeudo: 0, sfUsado: 0, status: 'pagado' },
  ];
  insertPagos(cobroIds['2025-12'], pagosDic, new Date(2025, 11, 5));

  // Jan 2026 — Most paid, depto 6 partial, depto 12 missed, depto 4 adelanto
  var pagosEne = [
    { depto: 1,  montoPagado: 350, montoAdeudo: 0,   sfUsado: 0, status: 'pagado' },
    { depto: 2,  montoPagado: 350, montoAdeudo: 0,   sfUsado: 0, status: 'pagado' },
    { depto: 3,  montoPagado: 350, montoAdeudo: 0,   sfUsado: 0, status: 'pagado' },
    { depto: 4,  montoPagado: 500, montoAdeudo: 0,   sfUsado: 0, status: 'adelanto' },
    { depto: 5,  montoPagado: 350, montoAdeudo: 0,   sfUsado: 0, status: 'pagado' },
    { depto: 6,  montoPagado: 200, montoAdeudo: 150, sfUsado: 0, status: 'pagado' },
    { depto: 7,  montoPagado: 350, montoAdeudo: 0,   sfUsado: 0, status: 'pagado' },
    { depto: 8,  montoPagado: 350, montoAdeudo: 0,   sfUsado: 0, status: 'pagado' },
    { depto: 10, montoPagado: 350, montoAdeudo: 0,   sfUsado: 0, status: 'pagado' },
    { depto: 11, montoPagado: 350, montoAdeudo: 0,   sfUsado: 0, status: 'pagado' },
    // depto 12 did not pay
  ];
  insertPagos(cobroIds['2026-01'], pagosEne, new Date(2026, 0, 8));

  // Feb 2026 — Mixed: depto 4 uses saldoFavor, depto 6 still partial, depto 11 adelanto
  var pagosFeb = [
    { depto: 1,  montoPagado: 350, montoAdeudo: 0,   sfUsado: 0,   status: 'pagado' },
    { depto: 2,  montoPagado: 350, montoAdeudo: 0,   sfUsado: 0,   status: 'pagado' },
    { depto: 3,  montoPagado: 350, montoAdeudo: 0,   sfUsado: 0,   status: 'pagado' },
    { depto: 4,  montoPagado: 200, montoAdeudo: 0,   sfUsado: 150, status: 'pagado' },
    { depto: 5,  montoPagado: 350, montoAdeudo: 0,   sfUsado: 0,   status: 'pagado' },
    { depto: 6,  montoPagado: 200, montoAdeudo: 150, sfUsado: 0,   status: 'pagado' },
    { depto: 7,  montoPagado: 350, montoAdeudo: 0,   sfUsado: 0,   status: 'pagado' },
    { depto: 8,  montoPagado: 350, montoAdeudo: 0,   sfUsado: 0,   status: 'pagado' },
    { depto: 10, montoPagado: 350, montoAdeudo: 0,   sfUsado: 0,   status: 'pagado' },
    { depto: 11, montoPagado: 500, montoAdeudo: 0,   sfUsado: 0,   status: 'adelanto' },
    { depto: 12, montoPagado: 350, montoAdeudo: 0,   sfUsado: 0,   status: 'pagado' },
  ];
  insertPagos(cobroIds['2026-02'], pagosFeb, new Date(2026, 1, 6));

  // Mar 2026 (current month) — In progress: deptos 1-3 paid, depto 4 adelanto, rest pending
  var pagosMar = [
    { depto: 1,  montoPagado: 350, montoAdeudo: 0, sfUsado: 0, status: 'pagado' },
    { depto: 2,  montoPagado: 350, montoAdeudo: 0, sfUsado: 0, status: 'pagado' },
    { depto: 3,  montoPagado: 350, montoAdeudo: 0, sfUsado: 0, status: 'pagado' },
    { depto: 4,  montoPagado: 500, montoAdeudo: 0, sfUsado: 0, status: 'adelanto' },
  ];
  insertPagos(cobroIds['2026-03'], pagosMar, new Date(2026, 2, 10));

  // --- 4. Set final saldoFavor on departamentos ---
  // Depto 4:  Jan overpaid +150, Feb used -150, Mar overpaid +150 → net = 150
  // Depto 11: Feb overpaid +150 → net = 150
  deptoSheet.getRange(5, 5).setValue(150);   // row 5 = depto 4
  deptoSheet.getRange(12, 5).setValue(150);  // row 12 = depto 11

  Logger.log('seedData: Completado exitosamente. 4 meses de cobros con pagos variados.');
}

/**
 * Helper: insert an array of payment objects for a given cobroId.
 */
function insertPagos(cobroId, pagos, fechaBase) {
  for (var i = 0; i < pagos.length; i++) {
    var p = pagos[i];
    appendRow(SHEET_PAGOS, [
      Utilities.getUuid(),
      cobroId,
      p.depto,
      p.montoPagado,
      p.montoAdeudo,
      p.sfUsado,
      fechaBase.toISOString(),
      '',       // comprobante
      p.status
    ]);
  }
}
