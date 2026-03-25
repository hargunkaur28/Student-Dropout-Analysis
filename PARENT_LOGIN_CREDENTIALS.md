# Parent Login Credentials

All parent accounts have been activated and are ready to use!

## How to Login as a Parent

1. Go to: http://localhost:5174/login
2. Use the credentials below
3. Password format: `{FirstChildName}2025`

---

## Available Parent Accounts

### 1. Robert Doe
- **Email:** `robert.doe@email.com`
- **Password:** `John2025`
- **Children:** John Doe (ST001) - Class 10A

### 2. James Smith
- **Email:** `james.smith@email.com`
- **Password:** `Jane2025`
- **Children:** Jane Smith (ST002) - Class 10A

### 3. Michael Johnson
- **Email:** `michael.johnson@email.com`
- **Password:** `Mike2025`
- **Children:** Mike Johnson (ST003) - Class 10B

### 4. Mr. Johnson
- **Email:** `johnson@email.com`
- **Password:** `Alice2025`
- **Children:** Alice Johnson (ST10A001) - Class 10A

### 5. Mr. Davis
- **Email:** `davis@email.com`
- **Password:** `Emma2025`
- **Children:** Emma Davis (ST10B002) - Class 10B

### 6. Someone Shreya (Multiple Children)
- **Email:** `someone@gmail.com`
- **Password:** `Tanvi2025`
- **Children:** 
  - Tanvi Shreya (29) - Class 11A
  - Kiara Rao (9A-001) - Class 9A
  - Risabh Sharma (9A-002) - Class 9A
  - Ankush Mishra (9B-001) - Class 9B
  - Riya Choudhary (9B-002) - Class 9B
  - Sahil Kumar (10A-001) - Class 10A
  - Yash Sharma (10A-002) - Class 10A

### 7. Someone Roy
- **Email:** `khushi@gmail.com`
- **Password:** `Khushi2025`
- **Children:** Khushi Roy (10B-001) - Class 10B

### 8. Someone Saini
- **Email:** `shreya@gmail.com`
- **Password:** `Shreya2025`
- **Children:** Shreya Saini (11A-001) - Class 11A

---

## Quick Test Login

**Recommended for testing:**
- Email: `someone@gmail.com`
- Password: `Tanvi2025`
- (This account has 7 children linked, good for testing)

---

## Troubleshooting

If you still can't login:

1. **Check the backend server is running:**
   ```bash
   cd backend
   npm run dev
   ```

2. **Check the frontend is running:**
   ```bash
   cd frontend
   npm run dev
   ```

3. **Verify parent account status:**
   ```bash
   cd backend
   node showParentCredentials.js
   ```

4. **Check a specific parent:**
   ```bash
   cd backend
   node src/utils/checkParentAccount.js someone@gmail.com
   ```

---

## Password Reset

If you need to reset a parent's password, you can do it through the admin panel or by updating the User model directly in MongoDB.

The default password format is: `{FirstChildName}2025`

For example:
- If the first child is named "Rahul", the password is `Rahul2025`
- If the first child is named "Priya", the password is `Priya2025`

---

## Notes

- All parent accounts are now **ACTIVE** ✅
- Parents can view their children's:
  - Attendance records
  - Academic performance
  - Risk analysis
  - Teacher observations
  - Communication history
- Parents receive email/SMS notifications for important updates
