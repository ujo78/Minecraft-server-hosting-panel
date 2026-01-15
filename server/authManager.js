const fs = require('fs');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

class AuthManager {
    constructor(usersFilePath) {
        this.usersFilePath = usersFilePath;
        this.users = [];
        this.loadUsers();
    }

    loadUsers() {
        if (fs.existsSync(this.usersFilePath)) {
            try {
                this.users = JSON.parse(fs.readFileSync(this.usersFilePath, 'utf8'));
            } catch (err) {
                console.error("Failed to parse users.json, initializing empty.");
                this.users = [];
            }
        }
    }

    saveUsers() {
        fs.writeFileSync(this.usersFilePath, JSON.stringify(this.users, null, 2));
    }

    // --- Local Auth ---

    async register(username, password, isAdmin = false) {
        // basic check
        if (this.users.find(u => u.username === username)) {
            throw new Error('Username already exists');
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = {
            id: Date.now().toString(),
            username,
            password: hashedPassword,
            isAdmin,
            provider: 'local',
            created: new Date().toISOString()
        };

        this.users.push(newUser);
        this.saveUsers();
        return this.generateToken(newUser);
    }

    async login(username, password) {
        const user = this.users.find(u => u.username === username);
        if (!user) return null;
        if (user.provider === 'google') return null; // Prevent local login for google users

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return null;

        return this.generateToken(user);
    }

    // --- Google Auth ---

    async findOrCreateGoogleUser(profile) {
        let user = this.users.find(u => u.googleId === profile.id);

        if (user) {
            return user;
        }

        // Check if allow-list logic is needed? For now, open registration or maybe strict?
        // Let's allow creation for simplicity, but maybe mark non-admins?
        // First user ever becomes admin?
        const isFirstUser = this.users.length === 0;

        user = {
            id: Date.now().toString(),
            username: profile.displayName || profile.emails[0].value,
            email: profile.emails[0].value,
            googleId: profile.id,
            isAdmin: isFirstUser, // First user is admin
            provider: 'google',
            created: new Date().toISOString()
        };

        this.users.push(user);
        this.saveUsers();
        return user;
    }

    // --- Utils ---

    generateToken(user) {
        // Clean payload
        const payload = {
            id: user.id,
            username: user.username,
            isAdmin: user.isAdmin
        };

        return jwt.sign(payload, process.env.SESSION_SECRET || 'dev-secret-key', { expiresIn: '24h' });
    }

    hasUsers() {
        return this.users.length > 0;
    }
}

module.exports = AuthManager;
