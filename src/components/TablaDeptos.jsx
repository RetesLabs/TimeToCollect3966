import { formatPesos } from '../utils/format'

/**
 * Tabla reutilizable que muestra los 12 departamentos con su estado de pago.
 *
 * Props:
 * - departamentos: array de objetos { depto, nombre, telefono, activo, saldoFavor }
 * - pagos: array de objetos { depto, montoPagado, montoAdeudo, saldoFavorUsado, status }
 * - montoBase: number - monto base del cobro
 * - renderActions: (depto, pago) => ReactNode - render prop para la columna de acciones
 * - columnasOcultas: array opcional de ids de columnas a no renderizar
 *   ('depto' | 'residente' | 'porPagar' | 'status' | 'saldoFavor')
 */
function TablaDeptos({ departamentos = [], pagos = [], montoBase = 0, renderActions, columnasOcultas = [] }) {
  const show = (id) => !columnasOcultas.includes(id)

  // Index pagos by depto number for quick lookup
  const pagosMap = {}
  pagos.forEach((pago) => {
    pagosMap[pago.depto] = pago
  })

  const getStatusBadge = (pago, deptoActivo) => {
    if (!deptoActivo) {
      return <span className="badge badge--inactive">Inactivo</span>
    }
    if (!pago) {
      return <span className="badge badge--pending">Pendiente</span>
    }

    const status = (pago.status || '').toLowerCase()

    if (status === 'pagado' || pago.montoPagado >= montoBase) {
      return <span className="badge badge--paid">Pagado</span>
    }
    if (status === 'adelanto' || (pago.montoPagado > 0 && pago.montoPagado < montoBase)) {
      return <span className="badge badge--advance">Adelanto</span>
    }
    return <span className="badge badge--pending">Pendiente</span>
  }

  return (
    <div className="tabla-deptos-wrapper">
      <table className="tabla-deptos">
        <thead>
          <tr>
            {show('depto') && <th># Depto</th>}
            {show('residente') && <th className="col-residente">Residente</th>}
            {show('porPagar') && <th>Por Pagar</th>}
            {show('status') && <th>Status</th>}
            {show('saldoFavor') && <th>Saldo a Favor</th>}
            {renderActions && <th>Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {departamentos.map((dept) => {
            const pago = pagosMap[dept.depto]
            const isInactive = !dept.activo

            return (
              <tr
                key={dept.depto}
                className={isInactive ? 'tabla-deptos-row--inactive' : ''}
              >
                {show('depto') && <td>{dept.depto}</td>}
                {show('residente') && <td className="col-residente">{dept.nombre || '—'}</td>}
                {show('porPagar') && (
                  <td>
                    {formatPesos(pago ? (Number(pago.montoAdeudo) || 0) : montoBase)}
                  </td>
                )}
                {show('status') && <td>{getStatusBadge(pago, dept.activo)}</td>}
                {show('saldoFavor') && (
                  <td>
                    {dept.saldoFavor > 0
                      ? <span className="badge badge--saldo">{formatPesos(dept.saldoFavor)}</span>
                      : '—'}
                  </td>
                )}
                {renderActions && (
                  <td className="tabla-deptos-actions">
                    {renderActions(dept, pago)}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default TablaDeptos
