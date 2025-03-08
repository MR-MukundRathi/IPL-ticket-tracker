// API endpoints
const API_BASE_URL = '';

// Add these at the top of your file
let userDetails = null;
let currentMatchForSubscription = null;

// Fetch and display matches
async function loadMatches() {
    try {
        const response = await fetch(`${API_BASE_URL}/matches`);
        const matches = await response.json();
        
        const tbody = document.querySelector('#matchesTable tbody');
        tbody.innerHTML = '';
        
        matches.forEach(match => {
            // Debug log
            console.log('Match data:', match);
            console.log('Last checked time:', match.last_checked_time);
            
            const row = document.createElement('tr');
            
            // Determine ticket status and styling
            let statusText, statusClass;
            if (match.booking_status === null) {
                statusText = 'Closed';
                statusClass = 'status-closed';
            } else if (match.booking_status === true) {
                statusText = 'Opened';
                statusClass = 'status-opened';
            } else {
                statusText = 'Not opened';
                statusClass = 'status-not-opened';
            }
            
            row.innerHTML = `
                <td>#${match.match_id}</td>
                <td class="match-date">
                    <i class="far fa-calendar me-1"></i>
                    ${new Date(match.date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                    })}
                </td>
                <td class="team-name home-team">
                    ${match.home_team}
                </td>
                <td class="team-name away-team">
                    ${match.away_team}
                </td>
                <td class="venue">
                    ${match.venue}
                </td>
                <td class="stadium">
                    ${match.stadium}
                </td>
                <td>
                    <span class="status-badge ${statusClass}">
                        <i class="fas fa-circle me-1"></i>
                        ${statusText}
                    </span>
                </td>
                <td class="booking-link">
                    ${match.booking_url ? 
                        `<a href="${match.booking_url}" 
                            target="_blank" 
                            class="btn btn-sm btn-book">
                            <i class="fas fa-external-link-alt me-1"></i>Book Now
                        </a>` : 
                        '<span class="text-muted">-</span>'
                    }
                </td>
                <td class="last-checked" data-timestamp="${match.last_checked_time || ''}">
                    ${getRelativeTime(match.last_checked_time)}
                    <span class="debug-info" style="display: none;">
                        Raw: ${match.last_checked_time}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm ${match.notification_subscribed ? 'btn-success' : 'btn-outline-primary'} subscribe-btn"
                            data-match-id="${match.match_id}"
                            onclick="handleSubscription(${match.match_id})">
                        <i class="fas ${match.notification_subscribed ? 'fa-bell' : 'fa-bell-slash'} me-1"></i>
                        ${match.notification_subscribed ? 'Subscribed' : 'Subscribe'}
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });

        // Update match selection in registration form
        const matchSelection = document.querySelector('#matchSelection');
        matchSelection.innerHTML = matches.map(match => `
            <div class="form-check">
                <input class="form-check-input" type="checkbox" value="${match.match_id}" name="matches">
                <label class="form-check-label">
                    <span class="home-team">${match.home_team}</span>
                    <span class="vs-text">vs</span>
                    <span class="away-team">${match.away_team}</span>
                    <small class="text-muted">
                        (${new Date(match.date).toLocaleDateString()})
                    </small>
                </label>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error loading matches:', error);
        alert('Failed to load matches. Please try again later.');
    }
}

// Register user
async function registerUser() {
    const form = document.getElementById('registrationForm');
    const selectedMatches = [...form.querySelectorAll('input[name="matches"]:checked')]
        .map(cb => parseInt(cb.value));
    
    if (selectedMatches.length === 0) {
        alert('Please select at least one match.');
        return;
    }

    const userData = {
        name: form.querySelector('input[name="name"]').value,
        email: form.querySelector('input[name="email"]').value,
        phone: form.querySelector('input[name="phone"]').value,
        selected_matches: selectedMatches
    };

    try {
        const response = await fetch(`${API_BASE_URL}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Registration failed');
        }

        alert('Registration successful! You will be notified when tickets become available.');
        bootstrap.Modal.getInstance(document.getElementById('registerModal')).hide();
        form.reset();
    } catch (error) {
        console.error('Error registering user:', error);
        alert(error.message || 'Registration failed. Please try again.');
    }
}

// Load matches when page loads
document.addEventListener('DOMContentLoaded', function() {
    loadMatches();
    setInterval(updateRelativeTimes, 30000);
    setupSearchAndFilters();
    
    // Setup modal handlers
    document.getElementById('saveUserDetails').addEventListener('click', handleUserDetailsSubmit);
});

function setupSearchAndFilters() {
    const searchInput = document.getElementById('searchInput');
    const venueFilter = document.getElementById('venueFilter');
    const teamFilter = document.getElementById('teamFilter');

    searchInput.addEventListener('input', filterMatches);
    venueFilter.addEventListener('change', filterMatches);
    teamFilter.addEventListener('change', filterMatches);
}

function loadMatches() {
    showLoadingSpinner();
    
    fetch('/matches')
        .then(response => response.json())
        .then(matches => {
            hideLoadingSpinner();
            updateMatchesTable(matches);
            updateFilters(matches);
            updateStats(matches);
        })
        .catch(error => {
            console.error('Error:', error);
            hideLoadingSpinner();
            showError('Failed to load matches');
        });
}

function updateMatchesTable(matches) {
    const tbody = document.querySelector('#matchesTable tbody');
    tbody.innerHTML = '';

    matches.forEach(match => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <span class="badge bg-primary">#${match.match_id}</span>
            </td>
            <td>
                <div class="d-flex align-items-center">
                    <i class="far fa-calendar me-2"></i>
                    <div>
                        <div class="fw-bold">${formatDate(match.date)}</div>
                        <div class="text-muted small">${formatTime(match.date)}</div>
                    </div>
                </div>
            </td>
            <td>
                <div class="teams-container">
                    <div class="team home-team">
                        <i class="fas fa-home me-1 text-muted"></i>
                        ${match.home_team}
                    </div>
                    <div class="team away-team">
                        <i class="fas fa-plane me-1 text-muted"></i>
                        ${match.away_team}
                    </div>
                </div>
            </td>
            <td>${match.venue}</td>
            <td>${match.stadium}</td>
            <td>
                ${getBookingStatusHTML(match.booking_status)}
            </td>
            <td>
                ${match.booking_url ? `
                    <a href="${match.booking_url}" 
                       target="_blank" 
                       class="btn btn-sm btn-outline-primary book-now-btn">
                        <i class="fas fa-external-link-alt me-1"></i>
                        Book Now
                    </a>
                ` : `
                    <button class="btn btn-sm btn-outline-secondary" disabled>
                        <i class="fas fa-clock me-1"></i>
                        Coming Soon
                    </button>
                `}
            </td>
            <td>
                <button class="btn btn-sm ${match.notification_subscribed ? 'btn-success' : 'btn-outline-primary'} subscribe-btn"
                        data-match-id="${match.match_id}"
                        onclick="handleSubscription(${match.match_id})">
                    <i class="fas ${match.notification_subscribed ? 'fa-bell' : 'fa-bell-slash'} me-1"></i>
                    ${match.notification_subscribed ? 'Subscribed' : 'Subscribe'}
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function updateFilters(matches) {
    const venues = new Set();
    const teams = new Set();

    matches.forEach(match => {
        venues.add(match.venue);
        teams.add(match.home_team);
        teams.add(match.away_team);
    });

    populateFilter('venueFilter', Array.from(venues));
    populateFilter('teamFilter', Array.from(teams));
}

function populateFilter(filterId, options) {
    const filter = document.getElementById(filterId);
    const currentValue = filter.value;

    filter.innerHTML = `<option value="">All ${filterId.replace('Filter', 's')}</option>`;
    options.sort().forEach(option => {
        filter.innerHTML += `<option value="${option}">${option}</option>`;
    });

    filter.value = currentValue;
}

function filterMatches() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const selectedVenue = document.getElementById('venueFilter').value;
    const selectedTeam = document.getElementById('teamFilter').value;

    const rows = document.querySelectorAll('#matchesTable tbody tr');

    rows.forEach(row => {
        const venue = row.children[3].textContent;
        const teams = row.children[2].textContent;
        const searchText = row.textContent.toLowerCase();

        const matchesSearch = searchTerm === '' || searchText.includes(searchTerm);
        const matchesVenue = selectedVenue === '' || venue === selectedVenue;
        const matchesTeam = selectedTeam === '' || teams.includes(selectedTeam);

        row.style.display = matchesSearch && matchesVenue && matchesTeam ? '' : 'none';
    });
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    });
}

function formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getBookingStatusHTML(status) {
    // Convert status to boolean and handle different status formats
    const isAvailable = String(status).toLowerCase() === 'true';
    
    return isAvailable ? 
        `<span class="booking-status status-available">
            <i class="fas fa-check-circle"></i>Available
         </span>` : 
        `<span class="booking-status status-unavailable">
            <i class="fas fa-times-circle"></i>Not Available
         </span>`;
}

function showLoadingSpinner() {
    document.getElementById('loadingSpinner').classList.remove('d-none');
}

function hideLoadingSpinner() {
    document.getElementById('loadingSpinner').classList.add('d-none');
}

function updateStats(matches) {
    document.getElementById('totalMatches').textContent = matches.length;
}

function getRelativeTime(timestamp) {
    if (!timestamp) return 'Never';
    
    // Debug log
    console.log('Processing timestamp:', timestamp);
    
    const now = new Date();
    const lastChecked = new Date(timestamp);
    
    // Debug log
    console.log('Parsed date:', lastChecked);
    
    // Check if date is valid
    if (isNaN(lastChecked.getTime())) {
        console.log('Invalid date');
        return 'Never';
    }
    
    const diffInSeconds = Math.floor((now - lastChecked) / 1000);
    
    if (diffInSeconds < 0) return 'Just now';
    
    if (diffInSeconds < 60) {
        return `${diffInSeconds} sec${diffInSeconds !== 1 ? 's' : ''} ago`;
    }
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
        return `${diffInMinutes} min${diffInMinutes !== 1 ? 's' : ''} ago`;
    }
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
        return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`;
    }
    
    return lastChecked.toLocaleDateString();
}

// Add auto-update for relative times
function updateRelativeTimes() {
    document.querySelectorAll('.last-checked').forEach(cell => {
        const timestamp = cell.dataset.timestamp;
        if (timestamp) {
            console.log('Updating time for timestamp:', timestamp);
            cell.textContent = getRelativeTime(timestamp);
        }
    });
}

// Update times every 30 seconds
setInterval(updateRelativeTimes, 30000);

function handleSubscription(matchId) {
    const btn = document.querySelector(`.subscribe-btn[data-match-id="${matchId}"]`);
    
    // Check if already subscribed
    if (btn.classList.contains('btn-success')) {
        alert('Already subscribed to this match!');
        return;
    }
    
    currentMatchForSubscription = matchId;
    
    if (!userDetails) {
        // Show modal for first-time users
        const modal = new bootstrap.Modal(document.getElementById('userDetailsModal'));
        modal.show();
    } else {
        // Direct subscription for existing users
        subscribeToMatch(matchId, userDetails);
    }
}

function handleUserDetailsSubmit() {
    const form = document.getElementById('userDetailsForm');
    const name = document.getElementById('userName').value;
    const email = document.getElementById('userEmail').value;
    const phone = document.getElementById('userPhone').value;

    if (!name || !email) {
        alert('Please fill in all required fields');
        return;
    }

    userDetails = { name, email, phone };
    
    // Subscribe to the match
    subscribeToMatch(currentMatchForSubscription, userDetails);
    
    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('userDetailsModal'));
    modal.hide();
}

function subscribeToMatch(matchId, userData) {
    const btn = document.querySelector(`.subscribe-btn[data-match-id="${matchId}"]`);
    
    // Show loading state
    btn.disabled = true;
    btn.innerHTML = `
        <span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
        Subscribing...
    `;

    fetch('/subscribe', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            match_id: matchId,
            user_data: userData
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Update button state
            btn.disabled = false;
            btn.classList.remove('btn-outline-primary');
            btn.classList.add('btn-success');
            btn.innerHTML = '<i class="fas fa-bell me-1"></i> Subscribed';
            
            // Show success message
            showToast('Success', 'Successfully subscribed to match notifications!', 'success');
        } else {
            throw new Error(data.message || 'Subscription failed');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        // Reset button state
        btn.disabled = false;
        btn.classList.remove('btn-success');
        btn.classList.add('btn-outline-primary');
        btn.innerHTML = '<i class="fas fa-bell-slash me-1"></i> Subscribe';
        
        showToast('Error', 'Failed to subscribe. Please try again.', 'error');
    });
}

// Add toast notification function
function showToast(title, message, type = 'info') {
    const toastHTML = `
        <div class="toast-container position-fixed bottom-0 end-0 p-3">
            <div class="toast" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="toast-header ${type === 'success' ? 'bg-success text-white' : 'bg-danger text-white'}">
                    <strong class="me-auto">${title}</strong>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>
                </div>
                <div class="toast-body">
                    ${message}
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', toastHTML);
    const toastElement = document.querySelector('.toast:last-child');
    const toast = new bootstrap.Toast(toastElement, { delay: 3000 });
    toast.show();
    
    // Remove toast after it's hidden
    toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.parentElement.remove();
    });
}

let newsIndex = 0;
let newsItems = [];

// Fetch news on page load
function fetchNews() {
    fetch('/news')
        .then(response => response.json())
        .then(data => {
            newsItems = data;
            if (newsItems.length > 0) {
                displayNews();
                setInterval(displayNews, 6000); // Change news every 6 seconds
            } else {
                document.getElementById('news-content').innerText = 'No live news available.';
                document.getElementById('news-header').innerText = ''; // Clear header if no news
            }
        })
        .catch(error => console.error('Error fetching news:', error));
}

function displayNews() {
    if (newsItems.length > 0) {
        const newsContent = document.getElementById('news-content');
        const newsDate = new Date(newsItems[newsIndex].date).toLocaleDateString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        // Create the news item HTML
        let newsHTML = `<span class="news-date">${newsDate}</span>: ${newsItems[newsIndex].news}`;
        
        // Check if the link is available
        if (newsItems[newsIndex].link) {
            newsHTML += ` <a href="${newsItems[newsIndex].link}" target="_blank" style="color: red; text-decoration: none;">
                <i class="fas fa-external-link-alt" style="font-size: 0.8rem;"></i>
            </a>`;
        }

        newsContent.innerHTML = newsHTML;

        // Update the header with the current news index
        const newsHeader = document.getElementById('news-header');
        newsHeader.innerText = `${newsIndex + 1}/${newsItems.length}`; // Show current index and total

        newsIndex = (newsIndex + 1) % newsItems.length; // Loop back to the first news item
    }
}

// Fetch news on page load
window.onload = fetchNews;