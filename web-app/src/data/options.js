// Mirrors Mobile_Library/src/data/options.js. Keep these two files in sync
// manually — if a college or program is added/renamed on one side, update
// the other, since both are used to validate/construct the same
// student.college / student.program values in the shared database.

export const yearLevels = [
  '1st Year',
  '2nd Year',
  '3rd Year',
  '4th Year',
  '5th Year',
];

export const sexOptions = [
  'Male',
  'Female',
  'Prefer not to say',
];

export const colleges = [
  'College of Agriculture, Food, Environment and Natural Resources',
  'College of Arts and Sciences',
  'College of Criminal Justice',
  'College of Economics, Management, and Development Studies',
  'College of Education',
  'College of Engineering and Information Technology',
  'College of Nursing',
  'College of Sports, Physical Education and Recreation',
  'College of Tourism and Hospitality Management',
  'College of Veterinary Medicine and Biomedical Sciences',
  'College of Medicine',
  'College of Advanced and Professional Studies',
];

export const collegeAcronyms = {
  'College of Agriculture, Food, Environment and Natural Resources': 'CAFENR',
  'College of Arts and Sciences': 'CAS',
  'College of Criminal Justice': 'CCJ',
  'College of Economics, Management, and Development Studies': 'CEMDS',
  'College of Education': 'CED',
  'College of Engineering and Information Technology': 'CEIT',
  'College of Nursing': 'CON',
  'College of Sports, Physical Education and Recreation': 'CSPEAR',
  'College of Tourism and Hospitality Management': 'CTHM',
  'College of Veterinary Medicine and Biomedical Sciences': 'CVMBS',
  'College of Medicine': 'COM',
  'College of Advanced and Professional Studies': 'CAPS',
};

export const toCollegeAcronym = (college) => {
  if (!college) return null;
  if (collegeAcronyms[college]) return collegeAcronyms[college];
  const found = Object.keys(collegeAcronyms).find(
    (key) => key.toLowerCase() === college.trim().toLowerCase()
  );
  return found ? collegeAcronyms[found] : college.trim().toUpperCase();
};

export const programsByCollege = {
  'College of Agriculture, Food, Environment and Natural Resources': [
    'Bachelor of Agricultural Entrepreneurship',
    'BS Agriculture',
    'BS Environmental Science',
    'BS Food Technology',
  ],
  'College of Arts and Sciences': [
    'BA Communication',
    'BA English Language Studies',
    'BA Journalism',
    'BA Political Science',
    'BS Applied Mathematics',
    'BS Biology',
    'BS Development Communication',
    'BS Psychology',
    'BS Social Work',
  ],
  'College of Criminal Justice': [
    'BS Criminology',
    'BS Industrial Security Management',
  ],
  'College of Economics, Management, and Development Studies': [
    'BS Accountancy',
    'BS Business Administration',
    'BS Development Management',
    'BS Economics',
    'BS International Studies',
    'BS Office Administration',
  ],
  'College of Education': [
    'Bachelor of Elementary Education',
    'Bachelor of Secondary Education',
    'Bachelor of Early Childhood Education',
    'Bachelor of Special Need Education',
    'Bachelor of Technology and Livelihood Education',
  ],
  'College of Engineering and Information Technology': [
    'BS Information Technology',
    'BS Agricultural and Biosystems Engr.',
    'BS Agricultural Engineering',
    'BS Architecture',
    'BS Civil Engineering',
    'BS Electronics Engineering',
    'BS Computer Engineering',
    'BS Computer Science',
    'BS Electrical Engineering',
    'BS Industrial Engineering',
    'BS Industrial Technology',
  ],
  'College of Nursing': [
    'BS Midwifery',
    'BS Medical Technology',
    'BS Nursing',
    'Diploma in Midwifery',
  ],
  'College of Sports, Physical Education and Recreation': [
    'Bachelor of Physical Education',
    'Bachelor of Exercise and Sports Sciences',
  ],
  'College of Tourism and Hospitality Management': [
    'BS Hospitality Management',
    'BS Tourism Management',
  ],
  'College of Veterinary Medicine and Biomedical Sciences': [
    'Doctor of Veterinary Medicine',
  ],
  'College of Medicine': [
    'Doctor of Medicine',
  ],
  'College of Advanced and Professional Studies': [
    'MA Education',
    'MA Agriculture',
    'Master of Business Administration',
    'Master of Engineering',
    'Master in Information Technology',
    'Master of Management',
    'Master of Public Administration',
    'Master of Science in Agriculture',
    'Master of Science in Biology',
    'Doctor of Philosophy in Agriculture',
    'Doctor of Philosophy in Education',
    'Doctor of Philosophy in Management',
    'Teaching Certificate Program',
  ],
};

// Show colleges and programs in A–Z order in every dropdown.
// (Sorted here once, so the lists above can stay in any order.)
const byName = (a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' });
colleges.sort(byName);
Object.values(programsByCollege).forEach((list) => list.sort(byName));
