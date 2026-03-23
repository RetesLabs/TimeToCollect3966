import { formatPesos } from '../utils/format'

/**
 * Tabla reutilizable que muestra los 12 departamentos con su estado de pago.
 *
 * Props:
 * - departamentos: array de objetos { depto, nombre, telefono, activo, saldoFavor }
 * - pagos: array de objetos { depto, montoPagado, montoAdeudo, saldoFavorUsado, status }
 * - montoBase: number - monto base del cobro
 * - renderActions: (depto, pago) => ReactNode - render prop para la columna de acciones
 */
function TablaDeptos({ departamentos = [], pagos = [], montoBase = 0, renderActions }) {
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
            <th># Depto</th>
            <th>Residente</th>
            <th>Por Pagar</th>
            <th>Status</th>
            <th>Saldo a Favor</th>
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
                <td>{dept.depto}</td>
                <td>{dept.nombre || '—'}</td>
                <td>
                  {formatPesos(pago ? (Number(pago.montoAdeudo) || 0) : montoBase)}
                </td>
                <td>{getStatusBadge(pago, dept.activo)}</td>
                <td>{formatPesos(dept.saldoFavor || 0)}</td>
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
