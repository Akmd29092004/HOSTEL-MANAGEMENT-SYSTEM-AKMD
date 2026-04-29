# 🔧 Production Setup Guide - Hostel Management System

## Step-by-Step Production Deployment

### Phase 1: Pre-Deployment (Days 1-2)

#### 1.1 Domain Setup
```bash
# Register domain (if needed)
# Recommended: Namecheap, GoDaddy, or Google Domains

# DNS Records Configuration:
# A Record: @        -> Your server/app IP
# A Record: www      -> Your server/app IP
# A Record: api      -> Backend service IP (if separate)
# CNAME:   api      -> backend.yourdomain.com (if on same server)
```

#### 1.2 Database Setup (MongoDB Atlas)

1. Go to: https://www.mongodb.com/cloud/atlas
2. Create account and free cluster
3. **Whitelist IPs**:
   - Add `0.0.0.0/0` for development (change later to specific IPs)
4. **Create Database User**:
   - Username: `hostel_admin`
   - Password: Generate strong password
5. **Get Connection String**:
   ```
   mongodb+srv://hostel_admin:PASSWORD@cluster.mongodb.net/hostel_db
   ```
6. Create initial database: `hostel_db`

#### 1.3 Payment Gateway Setup (Razorpay - Optional)

1. Go to: https://razorpay.com/
2. Create Business Account
3. Verify identity and bank account
4. Enable Test Mode first
5. Get **Key ID** and **Key Secret** from Settings

**Test Credentials:**
- Card: `4111 1111 1111 1111`
- Expiry: Any future date
- CVV: Any 3 digits

---

### Phase 2: Infrastructure Setup (Days 3-5)

#### 2.1 Backend Deployment (Render.com Recommended)

**Step 1: Prepare Repository**
```bash
# Ensure these files exist:
# - backend/Dockerfile
# - backend/.env.example
# - backend/requirements.txt
# - docker-compose.yml

# Push to GitHub
git add .
git commit -m "Add deployment configuration"
git push origin main
```

**Step 2: Create Render Service**

1. Go to: https://dashboard.render.com/
2. Click "New +" → "Web Service"
3. **Select Repository**: Your GitHub repo
4. **Configuration**:
   - Name: `hostel-backend`
   - Environment: `Docker`
   - Region: Choose closest to users
   - Branch: `main`
5. **Advanced Settings**:
   - Auto-deploy: Enable
   - Health check path: `/api/`
6. Click "Create Web Service"

**Step 3: Set Environment Variables in Render**

Go to Service Settings → Environment:
```
MONGO_URL=mongodb+srv://hostel_admin:YOUR_PASSWORD@cluster.mongodb.net/hostel_db
DB_NAME=hostel_db
JWT_SECRET=<generated-32-char-secret>
ADMIN_EMAIL=admin@hostel.edu
ADMIN_PASSWORD=<strong-password>
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
RAZORPAY_KEY_ID=<your-key-id>
RAZORPAY_KEY_SECRET=<your-secret>
```

**Generate JWT Secret:**
```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

**Step 4: Verify Backend**
```bash
# Check deployment logs in Render
# Test API endpoint
curl https://your-backend-url.onrender.com/api/

# Expected response:
# {"service":"hostel-management","status":"ok"}
```

#### 2.2 Frontend Deployment (Vercel Recommended)

1. Go to: https://vercel.com/
2. Click "Add New" → "Project"
3. **Import Git Repository**: Select your repo
4. **Framework Preset**: React
5. **Configuration**:
   - Root Directory: `frontend`
   - Build Command: `yarn build`
   - Output Directory: `build`
   - Install Command: `yarn install`
6. **Environment Variables**:
   ```
   REACT_APP_API_URL=https://your-backend-url.onrender.com/api
   REACT_APP_RAZORPAY_KEY_ID=<your-key-id>
   ```
7. Click "Deploy"

**Step 5: Verify Frontend**
```bash
# Vercel will provide a deployment URL
# Visit the URL and test login
# Email: admin@hostel.edu
# Password: <your-admin-password>
```

#### 2.3 Domain Configuration

**Add Custom Domain to Vercel:**
1. Vercel Dashboard → Settings → Domains
2. Enter your domain: `yourdomain.com`
3. Add DNS records as shown by Vercel
4. Wait 24-48 hours for propagation

**Enable SSL (Automatic with Vercel/Render)**

---

### Phase 3: Post-Deployment Testing (Day 6)

#### 3.1 Test Authentication
```bash
# Test login endpoint
curl -X POST https://your-backend-url/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@hostel.edu",
    "password": "admin123"
  }'

# Expected: JWT token in response
```

#### 3.2 Test Database
```bash
# Login to MongoDB Atlas
# Collections → Check 'users' collection
# Verify admin user exists
```

#### 3.3 Test Frontend
1. Visit `https://yourdomain.com`
2. Login with admin credentials
3. Navigate through application
4. Test file uploads
5. Test fee payment flow (test mode)

#### 3.4 Security Testing
```bash
# Check HTTPS
curl -I https://yourdomain.com
# Should show: 301 redirect to https

# Check security headers
curl -I https://yourdomain.com | grep -i "Strict-Transport-Security"

# Test CORS
curl -X OPTIONS https://your-backend-url/api/ \
  -H "Origin: https://yourdomain.com"
```

---

### Phase 4: Production Hardening (Day 7)

#### 4.1 Security Hardening

**Backend Security:**
```env
# Update .env with production values
JWT_SECRET=<random-32-char-secret>
ADMIN_PASSWORD=<15+-char-strong-password>
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Remove localhost from CORS in production
# Never use wildcard "*" in CORS_ORIGINS
```

**Frontend Security:**
```bash
# Test Content Security Policy headers
curl -I https://yourdomain.com | grep -i "content-security"

# Verify API URL points to production
# Check .env.production
```

#### 4.2 Database Backups

**MongoDB Atlas Automatic Backups:**
1. Go to Cluster → Backup
2. Enable Backup (free for 7 days retention)
3. Test restore process

**Manual Backup Script:**
```bash
#!/bin/bash
# backup.sh
MONGO_URI="mongodb+srv://user:pass@cluster.mongodb.net/hostel_db"
BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"

mongodump --uri "$MONGO_URI" --out "$BACKUP_DIR"
tar -czf "$BACKUP_DIR.tar.gz" "$BACKUP_DIR"
rm -rf "$BACKUP_DIR"

# Upload to S3/Drive
# Keep last 30 days of backups
```

#### 4.3 Monitoring Setup

**Option A: Sentry (Error Tracking)**
```bash
# Backend
pip install sentry-sdk

# frontend
npm install @sentry/react
```

**Option B: LogRocket (Session Replay)**
```bash
# Frontend only
npm install logrocket
```

**Option C: Grafana (Metrics)**
```bash
# Self-hosted monitoring
docker run -d --name=grafana -p 3000:3000 grafana/grafana
```

#### 4.4 Email Notifications (Optional)

Add to backend/server.py:
```python
import smtplib
from email.mime.text import MIMEText

async def send_fee_notification(student_email, amount, due_date):
    # Implement email sending
    pass

async def send_complaint_update(student_email, complaint_id, status):
    # Implement email sending
    pass
```

---

### Phase 5: Go-Live (Day 8+)

#### 5.1 Final Checklist
- [ ] Admin can login with correct credentials
- [ ] Students can register/login
- [ ] Staff can mark attendance
- [ ] Fees can be created and paid (test mode)
- [ ] Complaints workflow works
- [ ] PDF generation works (report & receipts)
- [ ] Food menu updates
- [ ] All error messages are user-friendly
- [ ] Mobile responsive design works
- [ ] API rate limiting active
- [ ] Database backups running
- [ ] Monitoring/logging active
- [ ] SSL certificate valid
- [ ] CORS properly configured

#### 5.2 Create Initial Admin Users
```bash
# Via API
curl -X POST https://your-api/api/users \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "warden@hostel.edu",
    "password": "warden123",
    "name": "Hostel Warden",
    "role": "staff"
  }'
```

#### 5.3 Create Sample Data
1. Login as admin
2. Create rooms (Block A: 101-120, Block B: 201-220)
3. Create staff (Warden, Helper)
4. Onboard sample students
5. Create sample fees
6. Test complaint workflow
7. Update food menu

#### 5.4 Launch Announcement
```html
<!-- Email to users -->
Subject: Hostel Management System is Now Live!

Dear Hostel Members,

The new Hostel Management System is now available!

URL: https://yourdomain.com
Admin Email: admin@hostel.edu
Support: support@hostel.edu

Features:
✓ Online fee management
✓ Attendance tracking
✓ Complaint resolution
✓ Room management
✓ Weekly food menu

Login with your credentials.
```

---

### Phase 6: Ongoing Maintenance

#### 6.1 Weekly Tasks
- [ ] Review error logs
- [ ] Check database size
- [ ] Verify backups completed
- [ ] Update admin passwords (monthly)

#### 6.2 Monthly Tasks
- [ ] Security audit
- [ ] Performance optimization
- [ ] Dependency updates
- [ ] Database optimization/indexing

#### 6.3 Quarterly Tasks
- [ ] Full security audit
- [ ] Disaster recovery drill
- [ ] Capacity planning
- [ ] Feature roadmap review

---

## Key URLs & Credentials

```
Production URL:     https://yourdomain.com
Backend API:        https://your-backend-url/api/
API Docs:           https://your-backend-url/docs
Admin Dashboard:    https://yourdomain.com/admin

Default Login:
Email:              admin@hostel.edu
Password:           (your-strong-password)
```

---

## Support & Troubleshooting

### Common Issues

**"Cannot connect to database"**
- Check MongoDB Atlas IP whitelist
- Verify MONGO_URL in .env
- Test connection: `ping cluster.mongodb.net`

**"CORS error when fetching API"**
- Add your frontend domain to CORS_ORIGINS
- Restart backend service

**"SSL certificate error"**
- Wait 24-48 hours for DNS propagation
- Force HTTPS in Vercel settings
- Check domain DNS records

### Getting Help
- Check logs: Render/Vercel dashboard
- GitHub Issues: Report bugs
- Email: admin@hostel.edu

---

**Deployment Date**: [INSERT DATE]
**Last Updated**: 2026-04-29
**Status**: ✅ Production Ready

Congratulations! Your system is now live! 🎉
