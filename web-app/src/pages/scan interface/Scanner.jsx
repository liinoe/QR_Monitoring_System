import React, { useEffect, useState, useRef, useCallback } from "react";
import ScannerSideBar from "../../components/ScannerSideBar";
import logo from "../../assets/cvsu_logo.png";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

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
    const [guestsInside, setGuestsInside] = useState(0);

    const isLockedRef = useRef(false);
    const lastKeyTimeRef = useRef(Date.now());
    const audioCtxRef = useRef(null);

    const getAudioCtx = () => {
        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        return audioCtxRef.current;
    };

    const playTone = (freq, duration, type = 'sine', delay = 0, volume = 0.25) => {
        const ctx = getAudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.value = volume;
        osc.connect(gain);
        gain.connect(ctx.destination);
        const startTime = ctx.currentTime + delay;
        osc.start(startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        osc.stop(startTime + duration + 0.02);
    };

    const playEntrySound = () => {
        playTone(659.25, 0.12, 'sine', 0);
        playTone(987.77, 0.16, 'sine', 0.12);
    };

    const playExitSound = () => {
        playTone(523.25, 0.12, 'sine', 0);
        playTone(392.00, 0.18, 'sine', 0.12);
    };

    const playErrorSound = () => {
        playTone(220, 0.3, 'sawtooth', 0, 0.2);
    };

    const COLLEGE_ACRONYMS = {
        "college of agriculture, food, environment, and natural resources": "CAFENR",
        "college of agriculture, forestry, environment and natural resources": "CAFENR",
        "college of arts and sciences": "CAS",
        "college of criminal justice": "CCJ",
        "college of education": "CED",
        "college of engineering and information technology": "CEIT",
        "college of economics, management, and development studies": "CEMDS",
        "college of economics, management and development studies": "CEMDS",
        "college of nursing": "CON",
        "college of sports, physical education and recreation": "CSPEAR",
        "college of tourism and hospitality management": "CTHM",
        "college of veterinary medicine and biomedical sciences": "CVMBS",
    };

    const toAcronym = (college) => {
        if (!college) return null;
        const key = college.trim().toLowerCase();
        return COLLEGE_ACRONYMS[key] || college.trim().toUpperCase();
    };

    const fetchBoardData = async () => {
        try {
            const response = await fetch(`${API_URL}/api/logs/live-board`);
            const data = await response.json();
            const counts = {};
            let total = 0;
            data.forEach(item => {
                const code = toAcronym(item.college);
                if (code) counts[code] = (counts[code] || 0) + item.count;
                total += item.count;
            });
            setBoardData(counts);
            setTotalInside(total);
        } catch (err) {
            console.error("Board fetch error:", err);
        }
    };

    const fetchGuestsInside = async () => {
        try {
            const response = await fetch(`${API_URL}/api/guests/all`);
            const data = await response.json();
            setGuestsInside(data.filter(g => g.status === 'inside').length);
        } catch (err) {
            console.error("Guest fetch error:", err);
        }
    };

    useEffect(() => {
        fetchBoardData();
        fetchGuestsInside();
        const boardInterval = setInterval(() => {
            fetchBoardData();
            fetchGuestsInside();
        }, 5000);
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
            const response = await fetch(`${API_URL}/api/logs/scan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ qr_code: decodedText }),
            });

            const data = await response.json();

            if (response.ok) {
                if (data.action === 'entry') playEntrySound();
                else playExitSound();
                setScanResult(data);
                setStatus("ready");
                fetchBoardData();
            } else {
                playErrorSound();
                setStatus("error");
                setScanResult({
                    full_name: "ACCESS DENIED",
                    message: data.message || "This code is not linked to an approved account."
                });
            }
        } catch (err) {
            playErrorSound();
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

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f0f4f0', display: 'flex', flexDirection: 'column', fontFamily: 'Segoe UI, system-ui, sans-serif' }}>

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
                    <img
                        src={logo}
                        alt="CvSU Logo"
                        style={{ width: 48, height: 48, objectFit: 'contain', flexShrink: 0 }}
                    />
                    <div>
                        <div style={{ fontSize: '17px', fontWeight: 700, letterSpacing: '0.02em', lineHeight: 1.2 }}>
                            Library Patron Access and Monitoring System
                        </div>
                        <div style={{ fontSize: '11px', opacity: 0.75, marginTop: 2 }}>
                            Entry &amp; Exit Station — Ladislao N. Diwa Memorial Library
                        </div>
                    </div>
                </div>
                <div style={{ fontSize: '30px', fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                    {formatTime(currentTime)}
                </div>
            </div>

            <div style={{ display: 'flex', flex: 1 }}>

                <ScannerSideBar
                    currentTime={currentTime}
                    totalInside={totalInside}
                    guestsInside={guestsInside}
                    boardData={boardData}
                    colleges={colleges}
                />

                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', padding: '40px' }}>
                    <div style={{
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

                        <div style={{ width: '100%' }}>
                            <div style={{ textAlign: 'center', fontSize: '11px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>
                                Last scan result
                            </div>

                            <div style={{
                                border: `2px solid ${
                                    status === "error" ? '#fca5a5' :
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
                                        {status === "error" ? (scanResult?.full_name || "ACCESS DENIED") : scanResult?.full_name || "Waiting..."}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                                        {status === "error" ? (scanResult?.message || "Scan could not be verified.") : scanResult ? `${scanResult.program} | ${scanResult.student_number}` : "Scan code to verify access"}
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