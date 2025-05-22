# Deployment Guide for YouTube Content Blocker

This guide will walk you through the process of preparing, packaging, and publishing your YouTube Content Blocker extension to the Chrome Web Store.

## Prerequisites

Before you begin, make sure you have:

1. A Google account with access to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
2. Node.js and npm installed on your computer
3. A completed and tested version of the extension
4. A $5 one-time registration fee for the Chrome Web Store (if you haven't published an extension before)

## Step 1: Prepare Your Extension

1. Install development dependencies:
   ```
   npm install
   ```

2. Test your extension thoroughly:
   - Load it as an unpacked extension in Chrome
   - Test all features and edge cases
   - Check for any console errors
   - Verify it works on different YouTube layouts

3. Update the version number in `manifest.json` if needed

4. Make sure all URLs in the extension (GitHub links, support links, etc.) are valid

## Step 2: Build Your Package

1. Run the build script to generate a production-ready version:
   ```
   npm run build
   ```

2. This will create a `dist` folder containing:
   - All the extension files
   - A zip file (`youtube-content-blocker.zip`) ready for submission

## Step 3: Prepare Store Assets

1. Make sure you have all required Chrome Web Store assets:
   - Icon (128x128 PNG)
   - Screenshots (1280x800 or 640x400)
   - Detailed description (from store-submission.md)
   - Privacy policy statement

2. Review the `store-submission.md` file for all required store listing content

## Step 4: Upload to Chrome Web Store

1. Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)

2. Click "Add new item"

3. Upload the `youtube-content-blocker.zip` file

4. Fill in all required fields from your `store-submission.md` file:
   - Name
   - Description
   - Category
   - Language
   - Icon
   - Screenshots
   - Privacy policy

5. Choose "Public" as your visibility

6. Set distribution to the countries where you want the extension available

7. Click "Save draft" and then "Submit for review"

## Step 5: Wait for Review

1. Chrome Web Store review typically takes 2-3 business days

2. You may be asked to make changes if there are issues

3. Once approved, your extension will be published to the Chrome Web Store

## Step 6: Post-Publication

1. Update your GitHub repository with:
   - Chrome Web Store link
   - Latest version number
   - Installation instructions

2. Monitor for user feedback and bug reports

3. Prepare updates based on feedback and bug fixes

## Troubleshooting Common Issues

### Rejection Reasons

If your extension is rejected, common reasons include:

1. **Permissions**: Make sure all requested permissions are clearly justified
2. **Metadata**: Ensure your description and screenshots accurately reflect the extension
3. **Functionality**: The extension must function as described
4. **User Data**: Be clear about what data is collected and how it's used
5. **Policies**: Make sure the extension complies with Chrome Web Store policies

### Updating After Publication

To update your extension after it's published:

1. Make your changes and increment the version number in `manifest.json`
2. Run the build script again
3. Upload the new zip file to the Chrome Web Store
4. Submit for review

## Resources

- [Chrome Web Store Developer Documentation](https://developer.chrome.com/docs/webstore/)
- [Chrome Extension Development Guide](https://developer.chrome.com/docs/extensions/mv3/getstarted/)
- [Chrome Web Store Policies](https://developer.chrome.com/docs/webstore/program_policies/)

## Support

If you encounter issues with the deployment process, check:
- Chrome Web Store Developer Dashboard help section
- Chrome Extension development forums
- Your extension's GitHub issues section for community help
