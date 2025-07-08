import jwt from 'jsonwebtoken';
import admin from 'firebase-admin';
import User from '../models/User.js';

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: "proproductivity-3870d",
        clientEmail: "firebase-adminsdk-kcqxe@proproductivity-3870d.iam.gserviceaccount.com",
        privateKey: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC8xYxYxYxYxYxY\n-----END PRIVATE KEY-----\n".replace(/\\n/g, '\n')
      })
    });
    console.log('🔥 Firebase Admin SDK initialized');
  } catch (error) {
    console.log('⚠️ Firebase Admin SDK initialization failed, using basic token decode');
  }
}

export const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    let user = null;
    let firebaseUid = null;
    let email = null;
    let name = null;

    try {
      // Try Firebase Admin SDK verification first
      if (admin.apps.length > 0) {
        try {
          const decodedToken = await admin.auth().verifyIdToken(token);
          firebaseUid = decodedToken.uid;
          email = decodedToken.email;
          name = decodedToken.name || decodedToken.email?.split('@')[0] || 'User';
          console.log('🔥 Firebase token verified via Admin SDK:', email);
        } catch (adminError) {
          console.log('Firebase Admin verification failed, trying basic decode...');
        }
      }

      // Fallback to basic token decode
      if (!firebaseUid && token.includes('.')) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          firebaseUid = payload.user_id || payload.sub;
          email = payload.email;
          name = payload.name || email?.split('@')[0] || 'User';
          console.log('🔑 Firebase token decoded (basic):', email);
        } catch (decodeError) {
          console.log('Basic token decode failed, trying JWT...');
        }
      }

      // Handle Firebase user
      if (firebaseUid && email) {
        // Find or create user in MongoDB based on Firebase UID
        user = await User.findOne({ firebaseUid });
        
        if (!user) {
          // Create new user in MongoDB
          user = new User({
            firebaseUid,
            name,
            email,
            jobTitle: 'Content Creator',
            timezone: 'UTC-8',
            bio: 'AI enthusiast and content creator focused on productivity tools and automation.',
            settings: {
              notifications: {
                email: true,
                push: true,
                taskReminders: true,
                goalUpdates: true,
                emailCampaigns: true,
                scriptGeneration: true,
                googleAlerts: true,
                weeklySummary: true
              },
              appearance: {
                theme: 'light',
                compactMode: false,
                showAnimations: true
              }
            }
          });
          await user.save();
          console.log('✅ Created new user in MongoDB:', email);
        } else {
          console.log('✅ Found existing user in MongoDB:', email);
        }
      }
      
      // Fallback to JWT verification for backward compatibility
      if (!user) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
          user = await User.findById(decoded.userId).select('-password');
          console.log('🔑 JWT token verified for user:', user?.email);
        } catch (jwtError) {
          console.log('JWT verification failed');
        }
      }
      
      if (!user) {
        console.log('❌ No valid user found for token');
        return res.status(401).json({ message: 'Invalid token - user not found' });
      }

      // Ensure user has MongoDB _id for database queries
      if (!user._id) {
        console.log('❌ User missing MongoDB _id');
        return res.status(401).json({ message: 'Invalid user data' });
      }

      req.user = user;
      console.log(`✅ User authenticated: ${user.email} (ID: ${user._id})`);
      next();
    } catch (tokenError) {
      console.error('Token verification failed:', tokenError.message);
      return res.status(401).json({ message: 'Invalid token' });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ message: 'Authentication error' });
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    // Skip authorization for now in development
    next();
  };
};