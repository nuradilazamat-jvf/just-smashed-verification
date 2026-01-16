# Just Smashed – Verification App

Internal web application to collect, review, and manage restaurant photo submissions for menu item verification according to brand standards.

Partners upload photos per requirement, reviewers approve or reject submissions with comments, and admins manage users, partners, and master data.

---

## Features

### Core Flow

#### Dashboard

* Partners see only their assigned locations
* Reviewers and Admins see all locations
* Progress indicator based on approved submissions

#### Location View

* Browse menu items by category
* Open verification modal per menu item

#### Verification Modal

* Displays requirement checklist and example image
* Partners upload photos (submission is created, file stored in Firebase Storage)
* Shows latest submission status and reviewer comment

#### Review

* Reviewers/Admins see pending submissions (`status = submitted`)
* Approve or reject submissions
* Rejection requires a comment

#### Admin

* Create Partners and Locations (Firestore)
* Create users via callable Cloud Function (`adminCreateUser`)
* Automatically sets custom claims and Firestore user profile
* Triggers password reset email (user sets password themselves)

---

## Roles & Permissions

### Roles

* `partner`
* `reviewer`
* `admin`

### Authorization Model

Authorization is enforced using **Firebase Authentication custom claims**, which are the single source of truth for access control in Firestore and Storage rules.

Custom claims used:

* `role`
* `partnerId` (partners only)
* `locationIds` (array, partners only)

A Firestore user profile document exists at `users/{uid}` for UI convenience, but **security rules rely exclusively on custom claims**.

---

## Tech Stack

* **Frontend:** React, Vite, React Router
* **Styling:** Tailwind CSS
* **Backend:** Firebase

  * Authentication
  * Firestore
  * Storage
  * Cloud Functions (callable)

---

## Repository Structure

```
.
├─ public/
├─ src/
│  ├─ pages/
│  │  ├─ Login.jsx
│  │  ├─ Dashboard.jsx
│  │  ├─ Location.jsx
│  │  ├─ Review.jsx
│  │  ├─ Admin.jsx
│  │  └─ RestaurantViewer.jsx
│  ├─ shell/
│  │  └─ App.jsx
│  ├─ ui/
│  │  └─ VerifyModal.jsx
│  ├─ firebase.js
│  └─ index.css
├─ functions/
│  ├─ index.js
│  └─ package.json
├─ firestore.rules
├─ storage.rules
├─ firebase.json
├─ tailwind.config.cjs
└─ README.md
```

---

## Data Model (Firestore)

### Users

`users/{uid}`

```
{
  email: string,
  role: "partner" | "reviewer" | "admin",
  partnerId?: string,
  locationIds?: string[],
  createdAt: timestamp
}
```

### Partners & Locations

`partners/{partnerId}`

```
{
  name: string,
  shortName: string,
  isActive: boolean,
  brands: string[],
  createdAt: timestamp
}
```

`partners/{partnerId}/locations/{locationId}`

```
{
  name: string,
  address: string,
  brandIds: string[],
  isActive: boolean,
  createdAt: timestamp
}
```

---

### Brands, Menu Items & Requirements

`brands/{brandId}/menuItems/{itemId}`

```
{
  name: string,
  description?: string,
  category: string,
  image?: string
}
```

`brands/{brandId}/menuItems/{itemId}/requirements/{reqId}`

```
{
  title: string,
  angleHint?: string,
  checklist?: string[],
  exampleImageUrl?: string
}
```

---

### Submissions

`submissions/{submissionId}`

```
{
  brandId: string,
  partnerId: string,
  locationId: string,
  itemId: string,
  requirementId: string,
  status: "submitted" | "approved" | "rejected",
  submittedBy: uid,
  createdAt: timestamp,
  reviewedAt?: timestamp,
  reviewerUserId?: uid,
  reviewComment?: string,
  storagePath: string,
  photoUrl: string,
  fileName: string
}
```

---

## Storage Layout

Uploads follow a strict path structure:

```
brands/{brandId}/items/{itemId}/requirements/{reqId}/partners/{partnerId}/locations/{locationId}/{fileName}
```

Storage security rules enforce access based on the same claim logic as Firestore:

* Partners can write only to their assigned partner/location paths
* Reviewers/Admins can read all relevant files
* Non-authenticated users have no access

---

## Security Rules Overview

### Firestore

Rules are based on:

* `request.auth.token.role`
* `partnerId`
* `locationIds`

**Partners**

* Read only their own partner and locations
* Create submissions only for assigned locations

**Reviewers/Admins**

* Read all locations and submissions
* Update submissions (status and comments)

**Admins**

* Full access to partners, users, and master data

### Storage

* Write: partners only, restricted to assigned paths
* Read: reviewers/admins (partners optionally for own uploads)

---

## Local Setup

### 1. Install Dependencies

Frontend:

```bash
npm install
```

Cloud Functions:

```bash
cd functions
npm install
cd ..
```

### 2. Firebase Configuration

Ensure `src/firebase.js` exists and initializes:

* Authentication
* Firestore
* Storage
* Cloud Functions

### 3. Run Locally

```bash
npm run dev
```

Open the URL shown in the Vite output.

---

## Login & Routing Behavior

* Logged out users are redirected to `/login`
* Logged in users are redirected to the dashboard (`/`)
* Routing guard is implemented in `src/shell/App.jsx` using `onAuthStateChanged`

---

## Cloud Functions

### `adminCreateUser` (callable)

* Accessible only to admins (checked via custom claim)
* Creates Firebase Auth user
* Sets custom claims (`role`, `partnerId`, `locationIds`)
* Creates Firestore user profile
* Frontend triggers `sendPasswordResetEmail` so the user sets their own password

Deploy:

```bash
firebase deploy --only functions:adminCreateUser
```

If authentication fails:

```bash
firebase login --reauth
```

---

## Managing Custom Claims

Recommended approach:

* Use the Admin UI to create users
* Claims are set automatically by the Cloud Function

After changing claims, users must refresh their ID token:

* Logout and login again, or
* Call `getIdToken(true)` on the client

---

## Deployment

### Frontend

```bash
npm run build
firebase deploy --only hosting
```

### Firestore Rules

```bash
firebase deploy --only firestore:rules
```

### Storage Rules

```bash
firebase deploy --only storage
```

### Functions

```bash
firebase deploy --only functions
```

---

## Troubleshooting

### Missing or Insufficient Permissions

Common causes:

* User has outdated token claims (logout/login)
* Missing `partnerId` or `locationIds`
