// Turns the admin's rejection reason into friendly guidance for the student.
// Used by the Home screen card and the Resubmit form so both say the same thing.
//
// The reasons come from the admin's list on the website (Registrations.jsx):
//   "Not enrolled in the current semester"
//   "Information does not match university records"
//   "Registration form is unclear or incorrect"
//   "Details are unclear or invalid (e.g. name, address)"  (old reason, still shown for older rejections)
//   anything else = "Other" / custom text typed by the admin

// Returns { kind, message, buttonLabel, noEditsNeeded } for a rejection reason.
export function getRejectionGuide(reason, currentPeriod) {
     const text = (reason || '').trim();
     const lower = text.toLowerCase();
     const semester = currentPeriod || 'this semester';

     // Not enrolled yet: their details are fine, they just need to enroll first.
     if (lower.startsWith('not enrolled')) {
          return {
               kind: 'not_enrolled',
               message: `You're not enrolled for ${semester} yet. Once you're officially enrolled, you can resubmit — no changes to your details are needed.`,
               buttonLabel: "I'm Enrolled Now — Resubmit",
               noEditsNeeded: true,
          };
     }

     // Details don't match school records: they should double-check and fix.
     if (lower.startsWith('information does not match')) {
          return {
               kind: 'mismatch',
               message: 'Your details don’t match the university records. Check your name spelling, student number, college and program, then resubmit.',
               buttonLabel: 'Edit & Resubmit',
               noEditsNeeded: false,
          };
     }

     // The uploaded registration form couldn't be used to verify enrollment.
     if (lower.startsWith('registration form is unclear')) {
          return {
               kind: 'registration_form',
               message: `Your registration form couldn't be verified. It may be blurry, cut off, from another semester, or not yours. Upload a clear photo or PDF of your ${semester} registration form, then resubmit.`,
               buttonLabel: 'Upload & Resubmit',
               noEditsNeeded: false,
          };
     }

     // OLD reason (no longer in the admin's list, kept for students rejected before):
     // details look fake/unclear (e.g. "asdf" as address).
     if (lower.startsWith('details are unclear')) {
          return {
               kind: 'unclear',
               message: 'Some of your details look unclear or invalid (e.g. name or address). Update them, then resubmit.',
               buttonLabel: 'Edit & Resubmit',
               noEditsNeeded: false,
          };
     }

  // "Other" or a custom reason: show the admin's own words.
     return {
          kind: 'other',
          message: `${text || 'Your registration was not approved.'} Not sure what to change? Visit the library front desk.`,
          buttonLabel: 'Edit & Resubmit',
          noEditsNeeded: false,
     };
}