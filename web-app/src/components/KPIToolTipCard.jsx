import React from "react";
import Card from "./Card";
import HoverTooltip from "./HoverTooltip";

const InfoIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-gray-300 hover:text-gray-500 cursor-help transition-colors">
    <path fillRule="evenodd" d="M18 10A8 8 0 11 2 10a8 8 0 0116 0zM9 9a1 1 0 012 0v4a1 1 0 11-2 0V9zm1-4a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
  </svg>
);

const KpiTooltipCard = ({ tooltip, ...cardProps }) => (
     <div className="relative">
     <Card {...cardProps} />
     <div className="absolute top-3 right-3">
          <HoverTooltip label={tooltip}>
          <InfoIcon />
          </HoverTooltip>
     </div>
     </div>
);

export default KpiTooltipCard;