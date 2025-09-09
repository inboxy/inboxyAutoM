
// ============================================
// user-manager.js - User ID Management
// ============================================

import { generateId, getCookie, setCookie, setupNanoidFallback } from './utils.js';

export class UserManager {
    constructor() {
        this.userId = null;
        this.nanoidAvailable = false;
    }
    
    async init() {
        // Setup nanoid fallback
        this.nanoidAvailable = setupNanoidFallback();
        
        // Initialize user ID
        await this.initUserId();
    }
    
    async initUserId() {
        // Check for existing user ID in cookie
        let userId = getCookie('userId');
        
        if (!userId) {
            // Generate new 10 character unique ID
            if (this.nanoidAvailable && typeof nanoid === 'function') {
                try {
                    userId = nanoid(10);
                } catch (error) {
                    console.warn('Nanoid failed, using fallback:', error);
                    userId = generateId(10);
                }
            } else {
                userId = generateId(10);
            }
            
            // Store in cookie (expires in 1 year)
            setCookie('userId', userId, 365);
        }
        
        this.userId = userId;
        this.updateUI();
    }
    
    updateUI() {
        const userIdElement = document.getElementById('user-id');
        if (userIdElement) {
            userIdElement.textContent = this.userId;
        }
    }
    
    getUserId() {
        return this.userId;
    }
    
    regenerateUserId() {
        // Generate new user ID
        let newUserId;
        if (this.nanoidAvailable && typeof nanoid === 'function') {
            try {
                newUserId = nanoid(10);
            } catch (error) {
                console.warn('Nanoid failed, using fallback:', error);
                newUserId = generateId(10);
            }
        } else {
            newUserId = generateId(10);
        }
        
        // Update cookie
        setCookie('userId', newUserId, 365);
        
        // Update internal state
        this.userId = newUserId;
        this.updateUI();
        
        return newUserId;
    }
    
    clearUserId() {
        // Clear cookie by setting expiration to past date
        setCookie('userId', '', -1);
        this.userId = null;
        this.updateUI();
    }
