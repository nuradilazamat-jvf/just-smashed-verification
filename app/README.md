# Just Smashed – Verification WebApp

A React web application for **JustSmashed** partners. Partner restaurants upload product photos for quality verification. Reviewers and admins compare submissions against reference images and approve or reject each requirement.

---

## Tech Stack

- **Frontend:** React + Vite + React Router  
- **Styling:** Tailwind CSS  
- **Backend-as-a-Service:** Firebase  
  - Authentication (Email/Password)  
  - Firestore (NoSQL)  
  - *(Storage planned for real image uploads later)*  

---

## User Roles

### **Admin**
- Full access to all partners, partner restaurants, and submissions.  
- Sees all partner restaurants on the Dashboard.  
- Access to the Review panel.

### **Reviewer**
- Sees all partners and all submissions.  
- Can approve/reject and leave comments.  
- Access to the Review panel.

### **Partner (Restaurant Location)**
- Sees **only their own partner restaurants**.  
- Opens a restaurant → views the JustSmashed menu (burgers/wings/fries).  
- For each product, views requirements, reference photos, and a checklist.  
- Uploads photos for each requirement.  
- Sees the review status:  
  - not submitted  
  - pending  
  - approved  
  - rejected (with reviewer comment)  
- Sees product progress (approved/total requirements).

---

## Main Flows

### **1. Partner Flow**
1. Partner logs in.  
2. Dashboard displays **only their partner restaurants**.  
3. Enter a restaurant → see the product list.  
4. Select a product → modal with requirements + reference images.  
5. Upload photos (currently only metadata to Firestore).  
6. After review, statuses and comments appear for each requirement.

### **2. Reviewer / Admin Flow**
1. Reviewer/Admin logs in.  
2. Dashboard displays **all partner restaurants**.  
3. Visit **/review** to see all submissions with status `submitted`.  
4. Compare with reference examples.  
5. Approve or reject; optionally leave a comment.  
6. Submission updates and becomes visible to the partner.

### **3. Restaurant Viewer**
- Accessible at:  
  **`/restaurant?id=XXX`**  
- Shows restaurant name and basic information.  
- Useful for direct links to a partner restaurant.

---

## Project Structure

```text
just-smashed/
  app/                 # React + Vite frontend
    src/
      shell/App.jsx    # Layout + top nav + auth listener
      pages/
        Login.jsx
        Dashboard.jsx
        Location.jsx
        Review.jsx
        RestaurantViewer.jsx
      ui/
        VerifyModal.jsx
      seeds/
        seedBrandJustSmashed.js
        seedPartnerAndLocations.js
    .env               # Firebase config (NOT in git)
    package.json
    ...

  admin-scripts/       # Firebase Admin (custom claims)
    setClaims.js
    serviceAccountKey.json  # NOT in git
    package.json

  README.md
