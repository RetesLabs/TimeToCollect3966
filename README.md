# TimeToCollect3966

App web para llevar el control de las cuotas mensuales de un edificio de departamentos: crear cobros, registrar pagos, ver quién debe, guardar el histórico y mandar recordatorios por WhatsApp.

- **Frontend:** React 19 + Vite + React Router (JSX, sin TypeScript).
- **Backend:** Google Apps Script sobre una hoja de Google Sheets (`google-apps-script/Code.gs`).
- **Comprobantes:** se suben a una carpeta de Google Drive (`Comprobantes3966`).
- **Hosting:** GitHub Pages (`base: '/TimeToCollect3966/'` en `vite.config.js`).

## Pantallas

| Ruta | Qué hace |
|---|---|
| `/` Mes Actual | Tabla de departamentos con lo que debe cada uno. Se pueden ocultar columnas (solo visual, no se guarda). Con sesión de admin aparece un botón **WhatsApp** por departamento. |
| `/historico` Histórico | Meses anteriores con sus pagos. |
| `/admin` Admin | Requiere contraseña. Pestañas: **Crear Cobro**, **Gestionar Pagos**, **Gestionar Departamentos**, **Depósitos**, **Mensaje WhatsApp**. |

### Crear Cobro y snapshot del histórico

En la tabla de meses de **Crear Cobro** cada fila tiene un botón **Submit**. Al pulsarlo se guarda un snapshot del mes en la hoja `Historico` (nombre del residente de ese momento, monto, pagado y adeudo de todos los departamentos). Un mes con snapshot no se puede sobrescribir. La pantalla Histórico sigue leyendo de `Pagos`; `Historico` es una copia adicional.

### Depósitos adelantados

La pestaña **Depósitos** suma dinero directo al saldo a favor de un departamento (con nota opcional) y deja registro en la hoja `Depositos`. No resta ni corrige saldos.

### Mensaje de WhatsApp

La pestaña **Mensaje WhatsApp** edita la plantilla que usa el botón de Mes Actual. Se abre `https://wa.me/<telefono>?text=...` con el teléfono tal cual está en la columna `telefono` de `Departamentos`. Variables disponibles:

| Variable | Valor |
|---|---|
| `<nombre inquilino>` | Nombre del residente |
| `<numero de departamento>` | Número del departamento |
| `<mes-activo>` | Mes activo del cobro |
| `<adeudo-mes-actual>` | Adeudo del mes actual |
| `<adeudo-meses-pasados>` | Adeudo acumulado de meses pasados (se calcula en el frontend con el histórico de pagos) |
| `<saldo-a-favor>` | Saldo a favor actual |

Plantilla por defecto: `TimeToCollect3966: Hola vecino, recordatorio de pago de <mes-activo>. <adeudo-mes-actual>. Gracias.`

## Hojas del Spreadsheet

| Hoja | Columnas |
|---|---|
| `Departamentos` | depto, nombre, telefono, activo, saldoFavor |
| `Cobros` | id, mes, montoBase, fechaCreacion, mesActivo |
| `Pagos` | id, cobroId, depto, montoPagado, montoAdeudo, saldoFavorUsado, fechaPago, comprobante, status |
| `Historico` | cobroId, mes, anio, depto, nombre, montoBase, montoPagado, montoAdeudo, fechaSnapshot |
| `Depositos` | fecha, depto, monto, nota |
| `whatsapp-message` | Plantilla en la celda A1 (sin encabezado) |

`Historico` se escribe por posición: si creás la hoja a mano, respetá ese orden en la fila 1.

## Puesta en marcha

### 1. Backend (Google Apps Script)

1. Creá un proyecto de Apps Script y pegá el contenido de `google-apps-script/Code.gs`.
2. Ejecutá `setup()` una vez desde el editor. Crea las hojas y los encabezados que falten y, si no existe, define `ADMIN_PASSWORD` (por defecto `admin3966`; **cambiala** en las propiedades del script).
3. Desplegá como **Aplicación web** y copiá la URL (`.../exec`).
4. Cada vez que cambies `Code.gs` hay que publicar una **nueva versión** del deployment; si no, la app sigue llamando al código anterior.

### 2. Frontend

```bash
npm install
cp .env.example .env     # y poné la URL del paso anterior en VITE_GAS_URL
npm run dev
```

`.env`:

```
VITE_GAS_URL=https://script.google.com/macros/s/<ID_DEL_DEPLOYMENT>/exec
```

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo de Vite |
| `npm run build` | Build de producción en `dist/` |
| `npm run preview` | Sirve el build local |
| `npm run deploy` | Build y publicación en la rama `gh-pages` |

No hay suite de tests ni script de lint configurado.

## Estructura

```
google-apps-script/Code.gs   Backend: acciones doGet/doPost, setup()
src/api/                     sheets.js (llamadas al backend) y cache.js
src/pages/                   MesActual, Historico, Admin
src/components/              TablaDeptos, NuevoCobro, Navbar, LoginModal
src/context/                 AuthContext (sesión de admin)
src/utils/                   format.js, whatsapp.js
docs/                        Hoja de cálculo y notas iniciales
```

## Notas

- Las acciones de escritura del backend exigen la contraseña de admin (`requireAdmin`); la sesión se guarda en `sessionStorage`.
- Todo el texto de la interfaz está en español.
