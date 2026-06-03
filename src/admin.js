// Admin access control.
//
// Replace ADMIN_UID with your Firebase Auth UID.
// You can find it in Firebase Console → Authentication → Users.
//
// IMPORTANT: this UID must ALSO be set in firestore.rules
// (search for "ADMIN_UID" there). Both files need to match.
export const ADMIN_UID = 'O7B2SmIf1IW8MC4KqElp6dM4ukG3'

export const isAdmin = (user) => !!user && user.uid === ADMIN_UID
