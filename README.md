# 🍎 School Connect 🍏 - [Demo*](https://school-connect-blue.vercel.app/)
*Feel free to make an account to test. The email can be made up. Start with a Teacher account, add a student, then you can create a Parent account and join the classroom via code. Then as a Teacher you can link the parent account to the student. Thanks! :)

### By: *Ethan Um & Sarah Ruiz*
### [Presentation](https://www.canva.com/design/DAHBWIBqJk0/UaBMnl6Q0BrJ-MOJIwWYcg/edit?utm_content=DAHBWIBqJk0&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton)

### ☆ Inspiration
Growing up in a single-parent household with a busy mom and forgetful self, it was difficult to balance school work, permission slips, events, and simply being a child. We wanted to create a platform that makes staying involved as a parent more accessible so that students can focus on school and their childhoods. 

### ♞ What We Learned & Challenges Faced
Throughout the hackathon, we had difficulty balancing realism and idealism. Although we had many features we wanted to implement, we had to be mindful of limitations influenced by several factors. Barriers that can exist between parents and students are low parent availability, busy work schedules, time constraints, lost forms, student-dependent delivery, etc. Our team also has experience in working in the government and teaching; with this knowledge, we made sure to be considerate of potential limitations in funding and teacher capacity. We used the existing [York Region District School Board](https://www2.yrdsb.ca/) (YRDSB) website to act as a framework to demonstrate how it could be integrated and remain familiar to stakeholders. 

### ⚙︎ What it Does
**Parent Side**:
- Inbox
  - Access field trip forms, lunch orders, announcements, parent teacher interviews, etc.
  - Contact teacher/school
- Calendar
  - Quick view of field trips, school holidays, P.A. days, after school events
- My Student
  - View student's classes and clubs

**Teacher Side**:
- My Classes
  - Create classes & add students/parents
- Events
  - Create action items for parents & events
- Calendar
- Messages
- Report Cards
- Interviews
  - Schedule interviews with parents


### 𖤉 How We Built It (Tech Stack)
**Frontend**
- Next.js 16
- TypeScript
- Tailwind

**Backend**
- Next.js Server Actions
- API Routes for secure document delivery

**Authentication & Roles**
- Auth0 authentication
- Role-based access (parent / teacher)
- Secure onboarding with class-code joining

**Database & Storage**
- MongoDB for application data
- Base64 document storage for PDFs
- Protected document serving via API routes

**Core Features Powered**
- Events & class calendar
- Permission slips & signed forms
- Messaging between parents and teachers
- Report card distribution
- Interview booking system

## Getting Started

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.
