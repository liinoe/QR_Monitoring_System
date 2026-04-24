const Card = ({ title, value, color, border, subtitle }) => {
  return (
    <div className={`bg-white rounded p-4 border-t-4 ${border}`}>
      <p className="text-gray-500 text-sm">{title}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {subtitle && <p className={`text-xs ${color}`}>{subtitle}</p>}
    </div>
  );
};

export default Card;