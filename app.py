from flask import Flask, render_template, jsonify, request
import gspread
from oauth2client.service_account import ServiceAccountCredentials
import json
import os
from datetime import datetime
from google.oauth2 import service_account

app = Flask(__name__)

# Define the scopes
scopes = [
       'https://www.googleapis.com/auth/spreadsheets',
       'https://spreadsheets.google.com/feeds',
       'https://www.googleapis.com/auth/drive'  # Full access
   ]

# Load Google API credentials from environment variable
google_api_credentials = os.getenv('GOOGLE_API_CREDENTIALS')

if not google_api_credentials:
    raise ValueError("GOOGLE_API_CREDENTIALS environment variable is not set.")

# Parse the JSON string into a dictionary
credentials_dict = json.loads(google_api_credentials)

# Create a credentials object
credentials = service_account.Credentials.from_service_account_info(credentials_dict, scopes=scopes)

# Authorize the gspread client
gc = gspread.authorize(credentials)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/matches')
def get_matches():
    try:
        sheet = gc.open("IPL2025_Database")
        matches_sheet = sheet.worksheet("Matches")
        matches = matches_sheet.get_all_records()
        print("Matches data:", matches)  # Debug log
        return jsonify(matches)
    except Exception as e:
        print(f"Error fetching matches: {str(e)}")  # Debug log
        return jsonify({'error': str(e)}), 500

@app.route('/match/<int:match_id>')
def get_match_details(match_id):
    try:
        sheet = gc.open("IPL2025_Database")
        matches_sheet = sheet.worksheet("Matches")
        matches = matches_sheet.get_all_records()
        
        match = next((m for m in matches if m['match_id'] == match_id), None)
        if match:
            return jsonify(match)
        return jsonify({'error': 'Match not found'}), 404
    except Exception as e:
        print(f"Error fetching match details: {str(e)}")  # Debug log
        return jsonify({'error': str(e)}), 500

@app.route('/subscribe', methods=['POST'])
def subscribe_to_match():
    try:
        data = request.json
        print("Received data:", data)  # Debug log
        
        match_id = data.get('match_id')
        user_data = data.get('user_data')

        if not match_id or not user_data:
            print("Missing data - match_id:", match_id, "user_data:", user_data)  # Debug log
            return jsonify({'success': False, 'message': 'Missing required data'}), 400

        # Connect to Google Sheets
        sheet = gc.open("IPL2025_Database")
        users_sheet = sheet.worksheet("Users")

        # Debug log the sheet structure
        headers = users_sheet.row_values(1)
        print("Sheet headers:", headers)

        # Find column indices (with error handling)
        try:
            user_id_col = headers.index('User ID') + 1
            name_col = headers.index('Name') + 1
            email_col = headers.index('Email') + 1
            phone_col = headers.index('Phone') + 1
            matches_col = headers.index('Selected Matches') + 1
            timestamp_col = headers.index('Timestamp') + 1
        except ValueError as e:
            print("Header not found:", e)  # Debug log
            return jsonify({'success': False, 'message': f'Sheet structure error: {str(e)}'}), 500

        # Check if user already exists
        existing_users = users_sheet.get_all_records()
        print("Existing users:", existing_users)  # Debug log
        
        user_exists = False
        user_id = None

        for user in existing_users:
            if user.get('Email') == user_data['email']:
                user_exists = True
                user_id = user.get('User ID')
                break

        print("User exists:", user_exists, "User ID:", user_id)  # Debug log

        if not user_exists:
            # Add new user
            user_id = len(existing_users) + 1
            new_row = [
                user_id,
                user_data['name'],
                user_data['email'],
                user_data['phone'] or '',
                str(match_id),
                datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            ]
            print("Adding new row:", new_row)  # Debug log
            users_sheet.append_row(new_row)
        else:
            # Update existing user's subscriptions
            try:
                user_row = next(i for i, user in enumerate(existing_users) if user.get('Email') == user_data['email']) + 2
                current_matches = users_sheet.cell(user_row, matches_col).value or ''
                print("Current matches:", current_matches)  # Debug log
                
                current_matches_list = set(map(str.strip, current_matches.split(','))) if current_matches else set()
                current_matches_list.add(str(match_id))
                new_matches = ','.join(sorted(current_matches_list))
                
                print("Updating row:", user_row, "column:", matches_col, "value:", new_matches)  # Debug log
                users_sheet.update_cell(user_row, matches_col, new_matches)
            except Exception as e:
                print("Error updating existing user:", str(e))  # Debug log
                return jsonify({'success': False, 'message': f'Error updating user: {str(e)}'}), 500

        return jsonify({
            'success': True,
            'message': 'Successfully subscribed to match notifications'
        })

    except Exception as e:
        import traceback
        print("Error in subscription:")
        print(traceback.format_exc())  # Detailed error trace
        return jsonify({
            'success': False,
            'message': f'Subscription error: {str(e)}'
        }), 500

# Fetch the news details from the sheet
@app.route('/news')
def get_news():
    try:
        sheet = gc.open("IPL2025_Database")
        news_sheet = sheet.worksheet("News")
        news_records = news_sheet.get_all_records()

        # Filter news with status "TRUE" and include the link
        live_news = [
            {
                'date': news['date'],
                'news': news['news'],
                'link': news.get('link')  # Fetch the link column
            }
            for news in news_records if news.get('status') == "TRUE"
        ]

        return jsonify(live_news)
    except Exception as e:
        print(f"Error fetching news: {str(e)}")  # Debug log
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True) 