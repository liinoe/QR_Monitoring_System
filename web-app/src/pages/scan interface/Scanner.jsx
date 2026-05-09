import React, { useEffect, useState, useRef } from "react";
import Header from "../../components/Header";
import ScannerSideBar from "../../components/ScannerSideBar";
import { Html5QrcodeScanner } from 'html5-qrcode';

const Scanner = () => {
		const [scanResult, setScanResult] = useState(null);
		const [status, setStatus] = useState("idle");
	const [isProcessing, setIsProcessing] = useState(false); // Only for UI feedback

	// Use Ref for the lock to prevent re-initializing the scanner
	const isLockedRef = useRef(false); 
		const beep = useRef(new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3"));

		useEffect(() => {
		const scanner = new Html5QrcodeScanner("reader", {
			fps: 10,
			qrbox: { width: 250, height: 250 },
			aspectRatio: 1.0,
			supportedScanTypes: [0]
		});

		const onScanSuccess = async (decodedText) => {
			// Check the Ref lock
			if (isLockedRef.current) return; 

			isLockedRef.current = true; // Lock immediately
			setIsProcessing(true); // Trigger UI overlay
			setStatus("scanning");
			
			try {
				const response = await fetch('http://localhost:5000/api/logs/scan', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ qr_code: decodedText }),
				});

				const data = await response.json();

				if (data.success) {
					beep.current.play(); 
					setScanResult(data); 
					setStatus("success");
				} else {
					setStatus("error");
					alert(`Access Denied: ${data.message}`);
				}
			} catch (err) {
				console.error("Scanner API Error:", err);
				setStatus("error");
			}

			// Cooldown period before allowing next scan
			setTimeout(() => {
				isLockedRef.current = false;
				setIsProcessing(false);
				setStatus("idle");
			}, 5000); 
		};

		scanner.render(onScanSuccess, (err) => {});

		return () => {
			scanner.clear().catch(err => console.error("Scanner cleanup failed", err));
		};
		}, []); // EMPTY dependency array - Scanner only initializes ONCE

	return (
	<div className="min-h-screen bg-white font-sans">
		<Header />
		<div className="flex">
		<ScannerSideBar />
		<div className="flex-1 flex flex-col items-center justify-center p-10 space-y-8">
			<div className="bg-[#F3FAF3] border border-green-300 rounded-lg p-6 text-center shadow-sm relative">
			<p className="text-gray-600 text-xl mb-4 font-semibold">Scan your QR code below!</p>
			
			{/* Visual Lock Overlay */}
			{isProcessing && (
			<div className="absolute inset-x-0 top-16 bottom-6 bg-white/40 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-lg">
				<div className="bg-green-600 text-white px-4 py-2 rounded-full text-sm font-bold animate-pulse shadow-lg">
				PROCESSING...
				</div>
			</div>
			)}
			<div id="reader" className="w-80 h-80 mx-auto overflow-hidden rounded-lg border-2 border-dashed border-green-200"></div>
			</div>

			<div className="w-full max-w-md border-t border-gray-100" />

			<div className={`w-full max-w-md bg-white border rounded-lg p-6 shadow-md transition-all duration-500 ${status === 'error' ? 'border-red-300' : 'border-green-300'}`}>
			<p className="text-center text-gray-600 text-lg mb-4">Last scan result</p>
			<div className="flex items-center gap-4">
			<div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center p-2">
				<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="green" className="w-8 h-8">
				<path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
				</svg>
			</div>
			<div>
				<h3 className="text-xl font-bold text-gray-800">{scanResult?.full_name || "Ready to Scan"}</h3>
				<p className="text-sm text-gray-500">
				{scanResult?.program || "Program Info"} <br />
				{scanResult?.student_number || "--- --- ---"}
				</p>
			</div>
			</div>
			<div className="mt-6 flex justify-between items-center">
			<div className={`flex items-center gap-2 px-4 py-1.5 rounded-full border ${scanResult ? 'bg-green-100 border-green-400' : 'bg-gray-50 border-gray-200'}`}>
				<span className={`font-bold text-xs ${scanResult ? 'text-green-800' : 'text-gray-400'}`}>
				{scanResult ? (scanResult.action === 'entry' ? "ENTRY ALLOWED" : "EXIT RECORDED") : "WAITING..."}
				</span>
			</div>
			<span className="text-gray-400 text-xs font-medium">{new Date().toLocaleTimeString()}</span>
			</div>
			</div>
		</div>
		</div>
	</div>
	);
};

export default Scanner;