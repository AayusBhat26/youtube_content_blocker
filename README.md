# YouTube Content Blocker

A Chrome extension that blocks YouTube videos containing specific keywords in their titles, or videos from specific content creators.

## Features

- Block videos containing specific keywords in their titles
- Block videos from specific content creators (channels)
- Multiple blocking modes: hide, blur, or replace with placeholder
- Flexible keyword matching: partial, exact, or whole word
- Case-sensitive matching option
- Context menu integration for quick blocking
- Statistics on blocked content
- Import/Export settings for backup or transfer
- Toggle extension on/off with a single click
- Performance optimization settings
- Comprehensive options page
- Support for all YouTube layouts (home, search, trending, watch, etc.)
- Support for YouTube Shorts

## Installation

### From Chrome Web Store

1. Go to the Chrome Web Store (link will be added when published)
2. Click "Add to Chrome"
3. Confirm the installation

### Manual Installation (Developer Mode)

1. Download or clone this repository to your computer
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in the top-right corner)
4. Click "Load unpacked" and select the extension folder
5. The extension should now be installed and active

## How to Use

### Basic Usage

1. Click the extension icon in the Chrome toolbar to open the popup
2. Add keywords to block videos containing those words in their titles
3. Add channel names to block all videos from those creators
4. Toggle the extension on/off using the switch at the bottom of the popup

### Advanced Usage

1. Right-click on a video or channel to access context menu options:
   - Block This Channel
   - Block Keyword From Title
   - Custom Block Keyword...
2. Access Advanced Options by clicking the link at the bottom of the popup:
   - Change blocking mode (hide, blur, replace)
   - Adjust keyword matching settings
   - View statistics on blocked content
   - Import/Export your settings

## Development

### Project Structure

- `manifest.json`: Extension configuration
- `popup.html`, `popup.css`, `popup.js`: UI for the extension popup
- `options.html`, `options.css`, `options.js`: Advanced options interface
- `content.js`: Contains the logic for blocking videos on YouTube
- `background.js`: Background script for extension event handling
- `utility.js`: Shared utility functions
- `guide.html`: Quick start guide for users
- `icons/`: Contains extension icons

### Technologies Used

- JavaScript (ES6+)
- Chrome Extension APIs
- HTML5 & CSS3
- YouTube DOM interaction

### Building for Production

To build the extension for production:

1. Ensure all code is finalized and tested
2. Run `npm run build` (if using build tools) or package manually
3. Create a ZIP file of the extension directory
4. Submit to the Chrome Web Store Developer Dashboard

## Customization

You can customize the extension by:

- Modifying the CSS in popup.css and options.css to change the appearance
- Adjusting the blocking logic in content.js to change how videos are filtered
- Adding new features to enhance functionality

## Contributing

Contributions are welcome! If you'd like to contribute:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License

## Privacy Policy

This extension does not collect any user data. All blocked keywords and creators are stored locally in your browser's storage and are not sent to any external servers.

## Support

If you encounter any issues or have questions, please open an issue on the GitHub repository or contact the developer.

## Changelog

### Version 1.0.0
- Initial release with core functionality
- Keyword and creator blocking
- Multiple blocking modes
- YouTube integration across all pages
- Statistics tracking
- Import/Export settings
2. Remove any unnecessary comments or development code
3. Package the extension folder as a ZIP file
4. Submit to the Chrome Web Store for review

## Customization

You can customize the extension by:

- Modifying the CSS in popup.css to change the appearance
- Adjusting the blocking logic in content.js to change how videos are filtered
- Adding new features to enhance functionality

## Contributing

Contributions are welcome! If you'd like to contribute:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License

## Privacy Policy

This extension does not collect any user data. All blocked keywords and creators are stored locally in your browser's storage and are not sent to any external servers.

## Support

If you encounter any issues or have questions, please open an issue on the GitHub repository or contact the developer.
