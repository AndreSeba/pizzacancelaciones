import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import Swal from 'sweetalert2';
import { format } from 'date-fns-tz';

// --- DatePicker ---
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

// --- Zona Horaria Bolivia ---
const TIME_ZONE = 'America/La_Paz';

const getLocalTime = () => {
    const now = new Date();
    const localDate = format(now, 'yyyy-MM-dd', { timeZone: TIME_ZONE });
    const localHour = parseInt(format(now, 'HH', { timeZone: TIME_ZONE }));
    return { localDate, localHour };
};

const { localDate: initialDate, localHour: initialHour } = getLocalTime();

const initialTurno = (initialHour >= 9 && initialHour < 15) ? 'AM' : 'PM';
const MAX_DATE_ALLOWED = initialDate;
const PAGE_SIZE = 5; // Cantidad de registros por página

export default function CajeroPage({ session, profile }) {
    const [flavors, setFlavors] = useState([]);
    const [reasons, setReasons] = useState([]);
    const [cajero, setCajero] = useState('');

    // Manejo correcto de fecha y turno
    const [turno, setTurno] = useState(initialTurno);
    const [fecha, setFecha] = useState(new Date(`${initialDate}T00:00:00`));

    const [pizzas, setPizzas] = useState([{ flavor: '', reason: '', cantidad: 1 }]);
    const [loading, setLoading] = useState(false);
    const [records, setRecords] = useState([]);
    const [expandedId, setExpandedId] = useState(null);

    // --- Paginación ---
    const [page, setPage] = useState(0);

    // Cargar catálogos
    useEffect(() => {
        const loadData = async () => {
            const { data: f } = await supabase
                .from('flavors')
                .select('id, name')
                .eq('is_active', true);

            const { data: r } = await supabase
                .from('cancellation_reasons')
                .select('id, reason')
                .eq('is_active', true);

            setFlavors(f || []);
            setReasons(r || []);

            loadRecords(0); // Cargar primera página al inicio
        };

        loadData();
    }, []);

    // Cargar registros con paginación
    const loadRecords = async (pageNumber) => {
        const from = pageNumber * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        const { data } = await supabase
            .from('cancellation_records')
            .select('id, date, turno, total_cancelled')
            .eq('created_by', session.user.id)
            .order('date', { ascending: false })
            .range(from, to);

        setRecords(data || []);
    };

    // Funciones para cambiar página
    const handleNextPage = () => {
        if (records.length < PAGE_SIZE) return; // No hay más páginas si la actual no está llena
        const nextPage = page + 1;
        setPage(nextPage);
        loadRecords(nextPage);
    };

    const handlePrevPage = () => {
        if (page === 0) return;
        const prevPage = page - 1;
        setPage(prevPage);
        loadRecords(prevPage);
    };

    // Pizzas handlers
    const handleAddPizza = () => {
        setPizzas([...pizzas, { flavor: '', reason: '', cantidad: 1 }]);
    };

    const handleRemovePizza = (index) => {
        setPizzas(pizzas.filter((_, i) => i !== index));
    };

    const handleChange = (index, field, value) => {
        const updated = [...pizzas];
        updated[index][field] = value;
        setPizzas(updated);
    };

    // Logout
    const handleLogout = async () => {
        const result = await Swal.fire({
            title: '¿Cerrar sesión?',
            text: '¿Está seguro que desea cerrar sesión?',
            showCancelButton: true,
            confirmButtonText: 'Sí, salir',
            cancelButtonText: 'Cancelar',
            icon: 'warning',
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
        });

        if (!result.isConfirmed) return;

        await supabase.auth.signOut();

        await Swal.fire({
            title: 'Sesión cerrada',
            text: 'Ha cerrado sesión correctamente.',
            icon: 'success',
            showConfirmButton: false,
            timer: 1200,
        });

        window.location.href = '/login';
    };

    // Guardar Registro
    const handleSave = async () => {

        if (!cajero.trim()) {
            await Swal.fire({
                icon: 'warning',
                title: 'Falta el nombre del cajero'
            });
            return;
        }

        if (!fecha) {
            await Swal.fire({
                icon: 'warning',
                title: 'Seleccione una fecha'
            });
            return;
        }

        if (pizzas.some((p) => !p.flavor || !p.reason || !p.cantidad)) {
            await Swal.fire({
                icon: 'warning',
                title: 'Complete todos los campos de las pizzas'
            });
            return;
        }

        setLoading(true);

        try {
            // Insertar cabecera
            const { data: record, error: err1 } = await supabase
                .from('cancellation_records')
                .insert([{
                    branch_id: profile.branch_id,
                    cashier_name: cajero,
                    date: format(fecha, 'yyyy-MM-dd', { timeZone: TIME_ZONE }),
                    turno,
                    total_cancelled: pizzas.length,
                    created_by: session.user.id,
                }])
                .select()
                .single();

            if (err1) throw err1;

            // Insertar pizzas
            const pizzasData = pizzas.map((p) => ({
                record_id: record.id,
                flavor_id: p.flavor,
                reason_id: p.reason,
                cantidad: p.cantidad,
            }));

            const { error: err2 } = await supabase
                .from('cancelled_pizzas')
                .insert(pizzasData);

            if (err2) throw err2;

            await Swal.fire({
                icon: 'success',
                title: 'Registro guardado correctamente',
                showConfirmButton: false,
                timer: 1200,
            });

            // Resetear formulario
            const { localDate: currentDate, localHour: currentHour } = getLocalTime();
            const currentTurno = (currentHour >= 7 && currentHour < 15) ? 'AM' : 'PM';

            setPizzas([{ flavor: '', reason: '', cantidad: 1 }]);
            setCajero('');
            setFecha(new Date(`${currentDate}T00:00:00`));
            setTurno(currentTurno);
            
            // Recargar registros (volvemos a la página 0 para ver el nuevo registro)
            setPage(0);
            loadRecords(0);

        } catch (e) {
            console.error(e);
            await Swal.fire({
                icon: 'error',
                title: 'Error al guardar'
            });
        } finally {
            setLoading(false);
        }
    };

    // Cargar detalle
    const toggleExpand = async (id) => {
        if (expandedId?.id === id) {
            setExpandedId(null);
            return;
        }

        const { data } = await supabase
            .from('cancelled_pizzas')
            .select('cantidad, flavor_id(name), reason_id(reason)')
            .eq('record_id', id);

        setExpandedId({ id, data });
    };

    return (
        <div style={{ padding: 24, backgroundColor: '#0c0c0c', color: '#fff', minHeight: '100vh' }}>

            {/* Header con Logo, Título y Botón Salir */}
            <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 30,
                flexWrap: 'wrap',
                gap: 10
            }}>
                {/* Logo */}
                <img 
                    src="/Logo - Pizza Rio.png" 
                    alt="Pizza Río Logo" 
                    style={{
                        height: 60,
                        width: 'auto',
                        maxWidth: '150px',
                        objectFit: 'contain'
                    }}
                />
                
                {/* Título centrado */}
                <div style={{ flex: 1, textAlign: 'center' }}>
                    <h1 style={{ color: '#fbd203ff', margin: 0 }}>Pizza Río</h1>
                    <h3 style={{ margin: '5px 0 0 0', fontWeight: 'normal' }}>Registro de Cancelaciones</h3>
                </div>
                
                {/* Botón Salir */}
                <button
                    onClick={handleLogout}
                    style={{
                        background: '#b71c1c',
                        border: 'none',
                        borderRadius: 8,
                        color: '#fff',
                        padding: '6px 12px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                    }}
                >
                    → Salir
                </button>
            </div>

            {/* Datos del Turno */}
            <div
                style={{
                    background: '#1a1a1a',
                    borderRadius: 16,
                    padding: 20,
                    marginBottom: 20,
                    boxShadow: '0 0 12px rgba(255,0,0,0.1)',
                }}
            >
                <h4 style={{ marginBottom: 10, color: '#ffcc00' }}>Datos del Turno</h4>

                <p><b>Sucursal:</b> {profile.branches?.name || '—'}</p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>

                    {/* Cajero */}
                    <div style={{ flex: 1, minWidth: 220 }}>
                        <label>Nombre del cajero</label>
                        <input
                            style={{
                                width: '100%',
                                padding: 8,
                                borderRadius: 8,
                                border: '1px solid #333',
                                background: '#111',
                                color: '#fff',
                            }}
                            type="text"
                            value={cajero}
                            onChange={(e) => setCajero(e.target.value)}
                            placeholder="Ingrese su nombre"
                        />
                    </div>

                    {/* DatePicker */}
                    <div style={{ width: 200 }}>
                        <label>Fecha</label>
                        <DatePicker
                            className="mi-datepicker-custom-input"
                            selected={fecha}
                            onChange={(date) => setFecha(date)}
                            dateFormat="dd-MM-yyyy"
                            maxDate={new Date(`${MAX_DATE_ALLOWED}T00:00:00`)}
                        />
                    </div>

                    {/* Turno */}
                    <div style={{ width: 120 }}>
                        <label>Turno</label>
                        <select
                            value={turno}
                            onChange={(e) => setTurno(e.target.value)}
                            style={{
                                width: '100%',
                                padding: 8,
                                borderRadius: 8,
                                border: '1px solid #333',
                                background: '#111',
                                color: '#fff',
                            }}
                        >
                            <option value="AM">AM (Mañana)</option>
                            <option value="PM">PM (Tarde)</option>
                        </select>
                    </div>

                </div>
            </div>

            {/* Pizzas Canceladas */}
            <div
                style={{
                    background: '#1a1a1a',
                    borderRadius: 16,
                    padding: 20,
                    marginBottom: 20,
                    boxShadow: '0 0 12px rgba(255,0,0,0.1)',
                }}
            >
                <h4 style={{ marginBottom: 10, color: '#ffcc00' }}>Pizzas Canceladas</h4>

                {pizzas.map((p, i) => (
                    <div
                        key={i}
                        style={{
                            border: '1px solid #333',
                            padding: 10,
                            borderRadius: 12,
                            marginBottom: 10,
                            background: '#111',
                        }}
                    >
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                            <select
                                value={p.flavor}
                                onChange={(e) => handleChange(i, 'flavor', e.target.value)}
                                style={{
                                    flex: 1,
                                    minWidth: 130,
                                    padding: 6,
                                    borderRadius: 6,
                                    background: '#000',
                                    color: '#fff',
                                }}
                            >
                                <option value="">Sabor</option>
                                {flavors.map((f) => (
                                    <option key={f.id} value={f.id}>
                                        {f.name}
                                    </option>
                                ))}
                            </select>

                            <select
                                value={p.reason}
                                onChange={(e) => handleChange(i, 'reason', e.target.value)}
                                style={{
                                    flex: 1,
                                    minWidth: 150,
                                    padding: 6,
                                    borderRadius: 6,
                                    background: '#000',
                                    color: '#fff',
                                }}
                            >
                                <option value="">Motivo</option>
                                {reasons.map((r) => (
                                    <option key={r.id} value={r.id}>
                                        {r.reason}
                                    </option>
                                ))}
                            </select>

                            <input
                                type="number"
                                value={p.cantidad}
                                min="1"
                                onChange={(e) => handleChange(i, 'cantidad', parseInt(e.target.value || '1', 10))}
                                style={{
                                    width: 80,
                                    padding: 6,
                                    borderRadius: 6,
                                    background: '#000',
                                    color: '#fff',
                                }}
                            />

                            {pizzas.length > 1 && (
                                <button
                                    onClick={() => handleRemovePizza(i)}
                                    style={{
                                        background: '#b71c1c',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: 8,
                                        padding: '6px 10px',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Eliminar
                                </button>
                            )}
                        </div>
                    </div>
                ))}

                <button
                    onClick={handleAddPizza}
                    style={{
                        marginTop: 10,
                        background: 'transparent',
                        border: '1px dashed #ffcc00',
                        color: '#ffcc00',
                        borderRadius: 8,
                        padding: '6px 10px',
                        cursor: 'pointer',
                    }}
                >
                    + Agregar otra pizza
                </button>

                <div style={{ marginTop: 20 }}>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        style={{
                            width: '100%',
                            padding: 10,
                            border: 'none',
                            borderRadius: 10,
                            background: '#e11',
                            color: '#fff',
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}
                    >
                        {loading ? 'Guardando...' : 'Guardar Registro'}
                    </button>
                </div>
            </div>

            {/* Registros Recientes */}
            <div
                style={{
                    background: '#1a1a1a',
                    borderRadius: 16,
                    padding: 20,
                    boxShadow: '0 0 12px rgba(255,0,0,0.1)',
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <h4 style={{ margin: 0, color: '#ffcc00' }}>Registros</h4>
                    <span style={{ fontSize: 12, color: '#888' }}>Página {page + 1}</span>
                </div>

                {records.length === 0 ? (
                    <p>No hay registros aún</p>
                ) : (
                    <>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ textAlign: 'left', color: '#ccc' }}>
                                    <th style={{ padding: '6px 0' }}>Fecha</th>
                                    <th>Turno</th>
                                    <th>Total</th>
                                    <th>Detalle</th>
                                </tr>
                            </thead>

                            <tbody>
                                {records.map((r) => (
                                    <tr key={r.id}>
                                        <td style={{ padding: '6px 0' }}>{r.date}</td>
                                        <td>{r.turno}</td>
                                        <td>{r.total_cancelled}</td>
                                        <td>
                                            <button
                                                onClick={() => toggleExpand(r.id)}
                                                style={{
                                                    background: '#f44336',
                                                    color: '#fff',
                                                    border: 'none',
                                                    borderRadius: 8,
                                                    padding: '4px 10px',
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                {expandedId?.id === r.id ? 'Ocultar' : 'Ver'}
                                            </button>

                                            {expandedId?.id === r.id && (
                                                <div style={{ marginTop: 8, paddingLeft: 10 }}>
                                                    {expandedId.data.map((p, i) => (
                                                        <p key={i} style={{ fontSize: 14, color: '#ccc' }}>
                                                            🍕 {p.flavor_id.name} — {p.reason_id.reason} — {p.cantidad}u
                                                        </p>
                                                    ))}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        
                        {/* Controles de Paginación */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 15 }}>
                            <button 
                                onClick={handlePrevPage} 
                                disabled={page === 0}
                                style={{
                                    background: '#333',
                                    color: page === 0 ? '#666' : '#fff',
                                    border: 'none',
                                    borderRadius: 6,
                                    padding: '6px 12px',
                                    cursor: page === 0 ? 'not-allowed' : 'pointer'
                                }}
                            >
                                Anterior
                            </button>
                            <button 
                                onClick={handleNextPage} 
                                disabled={records.length < PAGE_SIZE}
                                style={{
                                    background: '#333',
                                    color: records.length < PAGE_SIZE ? '#666' : '#fff',
                                    border: 'none',
                                    borderRadius: 6,
                                    padding: '6px 12px',
                                    cursor: records.length < PAGE_SIZE ? 'not-allowed' : 'pointer'
                                }}
                            >
                                Siguiente
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}