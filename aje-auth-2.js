// ============================================
// AL-JAZARI EDU — Shared Auth & User Module
// ============================================
// Import this as a module on every page.
// Provides: auth state, user profile, plan checking, nav updates.

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

// Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyA6XXSKUxjAeM6yCgaNtrZZvjy6Khk5GDg",
    authDomain: "aljazariedu-c4131.firebaseapp.com",
    databaseURL: "https://aljazariedu-c4131-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "aljazariedu-c4131",
    storageBucket: "aljazariedu-c4131.firebasestorage.app",
    messagingSenderId: "937448537048",
    appId: "1:937448537048:web:902de11f23800301cd50ad"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ============================================
// USER STATE
// ============================================
// Global user state accessible from any page
window.ajeUser = {
    firebaseUser: null,   // Firebase Auth user object
    profile: null,        // Firestore profile { plan, newsletter, ... }
    ready: false          // true once auth state is resolved
};

// Listeners that pages can register
const _authCallbacks = [];

/**
 * Register a callback for auth state changes.
 * callback(user, profile) — user is Firebase Auth user or null, profile is Firestore doc or null.
 */
export function onUserReady(callback) {
    if (window.ajeUser.ready) {
        callback(window.ajeUser.firebaseUser, window.ajeUser.profile);
    }
    _authCallbacks.push(callback);
}

/**
 * Check if current user has pro plan
 */
export function isPro() {
    return window.ajeUser.profile?.plan === 'pro';
}

/**
 * Check if user is logged in
 */
export function isLoggedIn() {
    return window.ajeUser.firebaseUser !== null;
}

/**
 * Get current user's display name
 */
export function getUserName() {
    if (!window.ajeUser.firebaseUser) return null;
    return window.ajeUser.firebaseUser.displayName || window.ajeUser.firebaseUser.email.split('@')[0];
}

// ============================================
// FIRESTORE USER PROFILE
// ============================================

/**
 * Create or update user profile in Firestore on first login
 */
async function ensureUserProfile(user) {
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
        return snap.data();
    } else {
        // First time — create profile
        const profile = {
            displayName: user.displayName || user.email.split('@')[0],
            email: user.email,
            plan: 'free',
            newsletter: false,
            createdAt: new Date().toISOString()
        };
        await setDoc(userRef, profile);
        return profile;
    }
}

/**
 * Update a field on the current user's profile
 */
export async function updateUserProfile(fields) {
    if (!window.ajeUser.firebaseUser) return;
    const userRef = doc(db, 'users', window.ajeUser.firebaseUser.uid);
    await updateDoc(userRef, fields);
    // Update local cache
    Object.assign(window.ajeUser.profile, fields);
}

// ============================================
// AUTH STATE LISTENER
// ============================================

onAuthStateChanged(auth, async (user) => {
    if (user) {
        window.ajeUser.firebaseUser = user;
        try {
            window.ajeUser.profile = await ensureUserProfile(user);
        } catch (e) {
            console.error('Firestore profile error:', e);
            window.ajeUser.profile = { plan: 'free', newsletter: false };
        }
    } else {
        window.ajeUser.firebaseUser = null;
        window.ajeUser.profile = null;
    }

    window.ajeUser.ready = true;

    // Update nav on every page
    updateNav(user);

    // Notify all registered callbacks
    _authCallbacks.forEach(cb => {
        try { cb(window.ajeUser.firebaseUser, window.ajeUser.profile); } catch (e) { console.error(e); }
    });
});

// ============================================
// NAV UPDATE (runs on every page)
// ============================================

function updateNav(user) {
    const area = document.getElementById('navAuthArea');
    if (!area) return;

    if (user) {
        const name = user.displayName || user.email.split('@')[0];
        area.innerHTML = `
            <span class="nav-user">
                <a href="profile.html" class="nav-user-name" title="My Profile">
                    <svg style="width:14px;height:14px;vertical-align:-2px;margin-right:3px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>${escapeHtml(name)}
                </a>
                <button class="nav-logout" id="logoutBtn">Log Out</button>
            </span>
        `;
        document.getElementById('logoutBtn').addEventListener('click', () => {
            signOut(auth).then(() => {
                // If on a page that requires auth, redirect
                if (window.location.pathname.includes('profile.html')) {
                    window.location.href = 'index.html';
                }
            });
        });
    } else {
        area.innerHTML = '<a href="auth.html" class="nav-login">Log In</a>';
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
}

// ============================================
// EXPORTS
// ============================================
export { app, auth, db };
