# Horiverse Website Setup Guide

## Contact Form Configuration

The contact form on the website is configured to use **Formspree**, a free service that handles form submissions and sends them to your email.

### Setup Steps:

1. **Create a Formspree Account**
   - Go to [https://formspree.io](https://formspree.io)
   - Sign up with your email (auyaman@gmail.com)
   - It's free for up to 50 submissions per month

2. **Create a New Form**
   - After logging in, click "New Form"
   - Give it a name like "Horiverse Contact Form"
   - Copy your unique form endpoint (it looks like: `https://formspree.io/f/xyzabc123`)

3. **Update the HTML**
   - Open `index.html`
   - Find line 138: `<form action="https://formspree.io/f/YOUR_FORM_ID" method="POST">`
   - Replace `YOUR_FORM_ID` with your actual Formspree form ID
   - Example: `<form action="https://formspree.io/f/xyzabc123" method="POST">`

4. **Test the Form**
   - Open your website
   - Fill out and submit the contact form
   - Check your email (auyaman@gmail.com) for the submission

### Alternative: Direct Email (Requires Backend)

If you prefer not to use Formspree, you'll need to set up a backend server to handle form submissions. Options include:
- PHP with mail() function
- Node.js with Nodemailer
- Python with Flask/Django
- Or any other server-side technology

## Game Store Links

Currently, the game store links are placeholders. To update them:

1. **For Horiku (Live Game)**
   - Get your Google Play Store link
   - Get your Apple App Store link
   - Update lines 73-74 in `index.html` with the actual store URLs

2. **For Horiblock (Coming Soon)**
   - Links are currently disabled (class="disabled")
   - When ready to launch, remove the `disabled` class
   - Add the actual store URLs

## Color Scheme

The website uses the following color palette:
- **Primary (Orange)**: `#d9b457`
- **Secondary (Grey)**: `#adadac`
- **Dark**: `#2a2a2a`
- **Light**: `#f9f9f9`

These colors are defined in `assets/css/style.css` at the top as CSS variables.

## Running Locally

To test the website locally:

```bash
# Using Python 3
python -m http.server 8000

# Using Node.js (requires http-server package)
npx http-server -p 8000

# Or simply open index.html in your browser
```

Then visit `http://localhost:8000` in your browser.

## Deployment

This is a static website and can be deployed to:
- **GitHub Pages** (free)
- **Netlify** (free)
- **Vercel** (free)
- **Firebase Hosting** (free)
- Any web hosting service

Simply upload all files to your hosting provider.

## Support

For questions or issues, contact: auyaman@gmail.com
