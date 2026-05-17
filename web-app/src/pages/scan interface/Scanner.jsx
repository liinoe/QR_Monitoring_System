import React, { useEffect, useState, useRef, useCallback } from "react";

const QRIcon = () => (
  <svg viewBox="0 0 100 100" width="120" height="120" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="5" width="38" height="38" rx="4" fill="none" stroke="#1B5E20" strokeWidth="6"/>
    <rect x="15" y="15" width="18" height="18" rx="2" fill="#1B5E20"/>
    <rect x="57" y="5" width="38" height="38" rx="4" fill="none" stroke="#1B5E20" strokeWidth="6"/>
    <rect x="67" y="15" width="18" height="18" rx="2" fill="#1B5E20"/>
    <rect x="5" y="57" width="38" height="38" rx="4" fill="none" stroke="#1B5E20" strokeWidth="6"/>
    <rect x="15" y="67" width="18" height="18" rx="2" fill="#1B5E20"/>
    <rect x="57" y="57" width="10" height="10" fill="#1B5E20"/>
    <rect x="73" y="57" width="10" height="10" fill="#1B5E20"/>
    <rect x="57" y="73" width="10" height="10" fill="#1B5E20"/>
    <rect x="73" y="73" width="22" height="10" fill="#1B5E20"/>
    <rect x="89" y="57" width="10" height="10" fill="#1B5E20"/>
  </svg>
);

const Scanner = () => {
    const [scanResult, setScanResult] = useState(null);
    const [status, setStatus] = useState("searching");
    const [isProcessing, setIsProcessing] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [boardData, setBoardData] = useState({});
    const [totalInside, setTotalInside] = useState(0);

    const isLockedRef = useRef(false);
    const lastKeyTimeRef = useRef(Date.now());
    const beep = useRef(new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3"));

    const fetchBoardData = async () => {
        try {
            const response = await fetch('http://localhost:5000/api/logs/live-board');
            const data = await response.json();
            const counts = {};
            let total = 0;
            data.forEach(item => {
                counts[item.college] = item.count;
                total += item.count;
            });
            setBoardData(counts);
            setTotalInside(total);
        } catch (err) {
            console.error("Board fetch error:", err);
        }
    };

    useEffect(() => {
        fetchBoardData();
        const boardInterval = setInterval(fetchBoardData, 5000);
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => {
            clearInterval(boardInterval);
            clearInterval(timer);
        };
    }, []);

    const handleScanAction = useCallback(async (decodedText) => {
        if (isLockedRef.current) return;
        isLockedRef.current = true;
        setIsProcessing(true);

        try {
            const response = await fetch('http://localhost:5000/api/logs/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ qr_code: decodedText }),
            });

            const data = await response.json();

            if (response.ok) {
                beep.current.play();
                setScanResult(data);
                setStatus("ready");
                fetchBoardData(); 
            } else {
                setStatus("error");
                // FIX: Displays the server's actual error payload text dynamically
                setScanResult({ 
                    full_name: "ACCESS DENIED", 
                    message: data.message || "Invalid or deactivated library pass token." 
                });
            }
        } catch (err) {
            setStatus("error");
            setScanResult({ full_name: "CONNECTION ERROR", message: "Cannot reach backend network." });
        }

        setTimeout(() => {
            setScanResult(null);
            setStatus("searching");
            isLockedRef.current = false;
            setIsProcessing(false);
        }, 5000); 
    }, []);
    
    useEffect(() => {
        let buffer = "";
        const handleKeyDown = (e) => {
            const now = Date.now();
            if (now - lastKeyTimeRef.current > 300) buffer = ""; 
            lastKeyTimeRef.current = now;
            if (e.key === "Enter") {
                if (buffer.length > 5) handleScanAction(buffer);
                buffer = "";
            } else if (e.key.length === 1) { buffer += e.key; }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleScanAction]);

    const colleges = [
        { id: 'CAFENR', color: '#16a34a' },
        { id: 'CEIT',   color: '#ea580c' },
        { id: 'CAS',    color: '#ca8a04' },
        { id: 'CON',    color: '#dc2626' },
        { id: 'CCJ',    color: '#9333ea' },
        { id: 'CSPEAR', color: '#7f1d1d' },
        { id: 'CEMDS',  color: '#ef4444' },
        { id: 'CTHM',   color: '#f97316' },
        { id: 'CED',    color: '#2563eb' },
        { id: 'CVMBS',  color: '#ec4899' },
    ];

    const formatTime = (date) =>
        date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const weekday = currentTime.toLocaleDateString('en-US', { weekday: 'long' });
    const monthDay = currentTime.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f0f4f0', display: 'flex', flexDirection: 'column', fontFamily: 'Segoe UI, system-ui, sans-serif' }}>

            {/* ── HEADER ── */}
            <div style={{
                backgroundColor: '#1B5E20',
                color: 'white',
                padding: '0 24px',
                height: '72px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                borderBottom: '3px solid #4CAF50',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                        width: 44, height: 44, backgroundColor: '#fff',
                        borderRadius: '8px', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', flexShrink: 0,
                        border: '2px solid #4CAF50',
                    }}>
                        <svg width="28" height="28" viewBox="0 0 28 28">
                            <polygon points="14,2 26,14 14,26 2,14" fill="#1B5E20"/>
                            <polygon points="14,6 22,14 14,22 6,14" fill="#4CAF50"/>
                        </svg>
                    </div>
                    <div>
                        <div style={{ fontSize: '17px', fontWeight: 700, letterSpacing: '0.02em', lineHeight: 1.2 }}>
                            Library Patron Access and Monitoring System
                        </div>
                        <div style={{ fontSize: '11px', opacity: 0.75, marginTop: 2 }}>
                            Entry &amp; Exit Station — Ladislao N. Diwa Memorial Library and Museum
                        </div>
                    </div>
                </div>
                <div style={{ fontSize: '30px', fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                    {formatTime(currentTime)}
                </div>
            </div>

            {/* ── BODY ── */}
            <div style={{ display: 'flex', flex: 1, padding: '20px', gap: '20px' }}>

                {/* ── LEFT SIDEBAR ── */}
                <div style={{ width: '220px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{
                        backgroundColor: '#1B5E20', color: 'white',
                        borderRadius: '10px', padding: '18px 16px',
                        textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    }}>
                        <div style={{ fontSize: '14px', opacity: 0.85, marginBottom: '4px' }}>{weekday},</div>
                        <div style={{ fontSize: '19px', fontWeight: 700, lineHeight: 1.3 }}>{monthDay}</div>
                    </div>

                    <div style={{
                        backgroundColor: '#fff', borderRadius: '10px',
                        padding: '18px 16px', textAlign: 'center',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                        border: '1px solid #e2e8e2',
                    }}>
                        <div style={{ fontSize: '64px', fontWeight: 800, color: '#1B5E20', lineHeight: 1 }}>
                            {totalInside}
                        </div>
                        <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '6px' }}>
                            Total Visitors Today
                        </div>
                    </div>

                    <div>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', marginLeft: '2px' }}>
                            Live Visitor Board
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            {colleges.map((col) => (
                                <div key={col.id} style={{
                                    backgroundColor: '#fff',
                                    borderRadius: '6px',
                                    padding: '8px 10px',
                                    borderLeft: `4px solid ${col.color}`,
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
                                }}>
                                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#374151' }}>{col.id}</span>
                                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>{boardData[col.id] ?? 0}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── MAIN CENTER ── */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
                    <div style={{
                        backgroundColor: '#fff',
                        borderRadius: '16px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.10)',
                        padding: '40px 48px',
                        width: '100%',
                        maxWidth: '560px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                    }}>
                        <div style={{
                            width: '180px', height: '180px',
                            border: `3px dashed ${status === "error" ? '#ef4444' : isProcessing ? '#22c55e' : '#d1d5db'}`,
                            borderRadius: '16px',
                            backgroundColor: status === "error" ? '#fef2f2' : isProcessing ? '#f0fdf4' : '#f9fafb',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.3s ease',
                        }}>
                            <QRIcon />
                        </div>

                        <div style={{ textAlign: 'center', marginTop: '20px' }}>
                            <div style={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                                Scan your QR code below!
                            </div>
                            <div style={{ color: '#374151', fontSize: '20px', marginTop: '6px', animation: 'bounce 1s infinite' }}>↓</div>
                        </div>

                        <hr style={{ width: '100%', border: 'none', borderTop: '1px solid #e5e7eb', margin: '24px 0' }} />

                        {/* Last scan result */}
                        <div style={{ width: '100%' }}>
                            <div style={{ textAlign: 'center', fontSize: '11px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>
                                Last scan result
                            </div>

                            <div style={{
                                border: `2px solid ${
                                    status === "error" ? '#fca5a5' : // Red for Expired
                                    !scanResult ? '#e5e7eb' : 
                                    scanResult.action === 'entry' ? '#bbf7d0' : '#fef08a'
                                }`,
                                borderRadius: '14px',
                                padding: '18px 20px',
                                backgroundColor: status === "error" ? '#fef2f2' : !scanResult ? '#f9fafb' : scanResult.action === 'entry' ? '#f0fdf4' : '#fefce8',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '16px',
                                transition: 'all 0.4s ease',
                            }}>
                                <div style={{
                                    width: '52px', height: '52px', borderRadius: '50%',
                                    backgroundColor: status === "error" ? '#fee2e2' : !scanResult ? '#e5e7eb' : scanResult.action === 'entry' ? '#dcfce7' : '#fef9c3',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0,
                                }}>
                                    <span style={{ fontSize: '24px' }}>
                                        {status === "error" ? '❌' : !scanResult ? '👤' : scanResult.action === 'entry' ? '✅' : '⚠️'}
                                    </span>
                                </div>

                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '18px', fontWeight: 800, color: status === "error" ? '#b91c1c' : '#111827' }}>
                                        {status === "error" ? "QR CODE EXPIRED" : scanResult?.full_name || "Waiting..."}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                                        {status === "error" ? "Student must refresh their mobile app." : scanResult ? `${scanResult.program} | ${scanResult.student_number}` : "Scan code to verify access"}
                                    </div>
                                    {scanResult && status !== "error" && (
                                        <div style={{
                                            marginTop: '8px',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '5px',
                                            padding: '3px 10px',
                                            borderRadius: '6px',
                                            border: `1px solid ${scanResult.action === 'entry' ? '#86efac' : '#fde047'}`,
                                            backgroundColor: scanResult.action === 'entry' ? '#dcfce7' : '#fef9c3',
                                            color: scanResult.action === 'entry' ? '#15803d' : '#854d0e',
                                            fontSize: '10px',
                                            fontWeight: 700,
                                            letterSpacing: '0.05em',
                                        }}>
                                            {scanResult.action === 'entry' ? '✓ ENTRY ALLOWED' : '⚠ EXIT RECORDED'}
                                        </div>
                                    )}
                                </div>

                                <div style={{ fontSize: '11px', color: '#9ca3af', fontFamily: 'monospace', textAlign: 'right', flexShrink: 0 }}>
                                    {scanResult ? new Date().toLocaleTimeString() : '--:--:--'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes bounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(5px); }
                }
            `}</style>
        </div>
    );
};

export default Scanner;