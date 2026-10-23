import React, { useState } from "react";

// Icons for the show / hide password button.
const ICONS = {
  eye: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: (
    <>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </>
  ),
};

// Draws one of the icons above.
const Icon = ({ name, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
    {ICONS[name]}
  </svg>
);

// Big soft input like the mobile app: plain gray box, turns white with a
// green outline when clicked. type="password" adds an eye button to show / hide it.
//   label   small uppercase label above the box
//   error   true = red outline
// (icon is ignored now — kept so older calls with icon="mail" don't pass it to the <input>)
export const AuthInput = ({ id, label, icon, type = "text", error = false, ...props }) => {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  return (
    <div>
      {label && (
        <label htmlFor={id} className="block text-[11px] font-bold text-gray-500 uppercase tracking-[0.06em] mb-2 ml-0.5">
          {label}
        </label>
      )}
      <div
        className={`flex items-center gap-2 h-[52px] pl-4 pr-2 rounded-[8px] border-[1.2px] transition-all
          ${error ? "bg-white border-[#B3261E]" : "bg-[#F7F8F7] border-transparent"}
          focus-within:bg-white focus-within:border-[#1B5E20] focus-within:ring-4 focus-within:ring-[#1B5E20]/10`}
      >
        <input
          id={id}
          type={isPassword && show ? "text" : type}
          className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-gray-900 placeholder:text-gray-400"
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow(!show)}
            aria-label={show ? "Hide password" : "Show password"}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors hover:bg-[#E8F1E9] ${show ? "text-[#1B5E20]" : "text-gray-400"}`}
          >
            <Icon name={show ? "eyeOff" : "eye"} />
          </button>
        )}
      </div>
    </div>
  );
};

// Same password rules as the server: 8+ characters, uppercase, lowercase, number.
export const checkPasswordRules = (pw) => ({
  len: pw.length >= 8,
  upper: /[A-Z]/.test(pw),
  lower: /[a-z]/.test(pw),
  num: /\d/.test(pw),
});

const RULE_LABELS = { len: "8+ characters", upper: "Uppercase letter", lower: "Lowercase letter", num: "A number" };

// Live checklist under the new-password box. Hidden until the user starts typing.
export const PasswordRules = ({ password }) => {
  if (!password) return null;
  const rules = checkPasswordRules(password);
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-2.5 ml-0.5 animate-[fadeIn_.18s_ease-out]">
      {Object.keys(RULE_LABELS).map((key) => (
        <li key={key} className={`flex items-center gap-1.5 text-[12.5px] ${rules[key] ? "text-[#1B5E20] font-semibold" : "text-gray-400"}`}>
          <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${rules[key] ? "bg-[#1B5E20] text-white" : "bg-[#F1F3F1] text-transparent"}`}>✓</span>
          {RULE_LABELS[key]}
        </li>
      ))}
    </ul>
  );
};

export default AuthInput;
