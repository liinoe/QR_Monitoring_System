import React from "react";
import Header from "../../components/Header";
import ScannerSideBar from "../../components/ScannerSideBar";

const Scanner = () => {
  return (
    <div className="min-h-screen bg-white font-sans">

      {/* HEADER */}
      <Header />

      <div className="flex">

        {/* LEFT PANEL */}
        <ScannerSideBar />

        {/* MAIN SCANNER AREA */}
        <div className="flex-1 flex flex-col items-center justify-center p-10 space-y-8">

          {/* SCANNER BOX */}
					<div className="bg-[#F3FAF3] border border-green-300 rounded-lg p-6 text-center">
					<p className="text-gray-600 text-xl mb-4">
							Scan your QR code below!
					</p>

					<div className="w-48 h-48 mx-auto flex items-center justify-center rounded">
							<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							strokeWidth={1.5}
							stroke="green"
							className="w-full h-full"
							>
								<path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z" />
								<path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75ZM6.75 16.5h.75v.75h-.75v-.75ZM16.5 6.75h.75v.75h-.75v-.75ZM13.5 13.5h.75v.75h-.75v-.75ZM13.5 19.5h.75v.75h-.75v-.75ZM19.5 13.5h.75v.75h-.75v-.75ZM19.5 19.5h.75v.75h-.75v-.75ZM16.5 16.5h.75v.75h-.75v-.75Z" />
							</svg>
					</div>
					</div>

          {/* DIVIDER */}
          <div className="w-full max-w-md border-t" />

          {/* LAST SCAN */}
          <div className="w-full max-w-md bg-white border border-green-300 rounded-lg p-6">

            <p className="text-center text-gray-600 text-lg mb-4">
              Last scan result
            </p>

           
						<div className="flex items-center gap-4">
							<div className="w-14 h-14 rounded flex items-center justify-center p-2">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									fill="none"
									viewBox="0 0 24 24"
									strokeWidth={1.5}
									stroke="green"
									className="w-full h-full"
								>
									<path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
								</svg>
							</div>

							<div>
								<h3 className="text-xl">John Doe</h3>
								<p className="text-sm text-gray-500">
									BSIT 3-3 - CEIT <br />
									202302075
								</p>
							</div>
						</div>

            <div className="mt-4 flex justify-between items-center">

              <div className="flex items-center gap-2 bg-green-50 border border-green-300 px-3 py-1 rounded">
                <span className="text-green-700 font-semibold text-sm">
                  ENTRY ALLOWED
                </span>
              </div>

              <span className="text-gray-500 text-sm">12:30:25</span>

            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

export default Scanner;