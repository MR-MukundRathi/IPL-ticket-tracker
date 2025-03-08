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
    console.log('DOM fully loaded, initializing application...');
    
    // Initialize the application
    loadMatches();
    
    // Set up timers
    setInterval(updateRelativeTimes, 30000);
    
    // Set up search and filters
    setupSearchAndFilters();
    
    // Fetch news
    fetchNews();
    
    // Setup modal handlers
    const saveUserDetailsBtn = document.getElementById('saveUserDetails');
    if (saveUserDetailsBtn) {
        saveUserDetailsBtn.addEventListener('click', handleUserDetailsSubmit);
    }
    
    console.log('Application initialization complete');
});

function setupSearchAndFilters() {
    const searchInput = document.getElementById('searchInput');
    const venueFilter = document.getElementById('venueFilter');
    const teamFilter = document.getElementById('teamFilter');

    // Make sure all elements exist before adding event listeners
    if (!searchInput || !venueFilter || !teamFilter) {
        console.error('Search or filter elements not found in the DOM');
        // Try again in a moment - DOM might not be fully loaded
        setTimeout(setupSearchAndFilters, 500);
        return;
    }

    // Debounce search input to improve performance (especially on mobile)
    let searchTimeout;
    searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(filterMatches, 300);
    });

    // Add change event listeners for filters
    venueFilter.addEventListener('change', filterMatches);
    teamFilter.addEventListener('change', filterMatches);
    
    console.log('Search and filters initialized successfully');
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
            
            // Apply initial filtering (in case there are filter values already set)
            setTimeout(filterMatches, 100);
            
            console.log(`Loaded ${matches.length} matches successfully`);
        })
        .catch(error => {
            console.error('Error:', error);
            hideLoadingSpinner();
            showToast('Error', 'Failed to load matches', 'error');
        });
}

function updateMatchesTable(matches) {
    const tbody = document.querySelector('#matchesTable tbody');
    tbody.innerHTML = '';

    matches.forEach((match, index) => {
        // Debug log to see the actual value
        console.log(`Match ${match.match_id} booking status:`, match.booking_status, typeof match.booking_status);
        
        // Check if booking_status indicates availability
        const isAvailable = isBookingAvailable(match.booking_status);
        
        // Format date and time, handling null or undefined values
        const formattedShortDate = formatDateShort(match.date);
        const formattedTime = match.time ? formatTime(match.time) : '';
        
        // Desktop View (Table Row)
        const tr = document.createElement('tr');
        tr.className = 'desktop-only';
        tr.innerHTML = `
            <td>${match.match_id}</td>
            <td>
                <div class="date-time-container">
                    <div class="date-time-inline">
                        <i class="far fa-calendar-alt me-1"></i>
                        <span class="date">${formattedShortDate}</span>
                        ${formattedTime ? `<span class="time"><i class="far fa-clock ms-2 me-1"></i>${formattedTime}</span>` : ''}
                    </div>
                </div>
            </td>
            <td>
                <div class="teams-container">
                    <div class="team home-team">
                        <i class="fas fa-home me-1 text-muted"></i>
                        ${match.home_team || 'TBD'}
                    </div>
                    <div class="team away-team">
                        <i class="fas fa-plane me-1 text-muted"></i>
                        ${match.away_team || 'TBD'}
                    </div>
                </div>
            </td>
            <td>${match.venue || 'TBD'}</td>
            <td>${match.stadium || 'TBD'}</td>
            <td>
                <span class="status-badge ${isAvailable ? 'status-available' : 'status-unavailable'}">
                    <i class="fas ${isAvailable ? 'fa-check-circle' : 'fa-times-circle'}"></i>
                    ${isAvailable ? 'Available' : 'Not Available'}
                </span>
            </td>
            <td>
                ${match.booking_url ? 
                    `<a href="${match.booking_url}" target="_blank" class="btn btn-primary btn-sm">
                        <i class="fas fa-ticket-alt me-1"></i>Book Now
                    </a>` : 
                    `<button class="btn btn-secondary btn-sm" disabled>
                        <i class="fas fa-clock me-1"></i>Not Available
                    </button>`
                }
            </td>
            <td>
                <button class="btn ${match.notification_subscribed ? 'btn-success' : 'btn-outline-primary'} btn-sm subscribe-btn" 
                        data-match-id="${match.match_id}"
                        onclick="handleSubscription(${match.match_id})"
                        ${isAvailable ? 'disabled' : ''}>
                    <i class="fas ${match.notification_subscribed ? 'fa-bell' : 'fa-bell-slash'} me-1"></i>
                    ${match.notification_subscribed ? 'Subscribed' : 'Subscribe'}
                </button>
            </td>
        `;
        tbody.appendChild(tr);

        // Mobile View (Card) - Updated with date in match number container
        const card = document.createElement('div');
        card.className = 'mobile-only match-card';
        card.innerHTML = `
            <div class="match-card-header">
                <div class="match-meta">
                    <div class="match-number">
                        #${match.match_id}
                        <span class="match-date-short">
                            <i class="far fa-calendar-alt"></i>
                            ${formattedShortDate}
                        </span>
                    </div>
                    ${formattedTime ? 
                        `<div class="match-time">
                            <i class="far fa-clock"></i>
                            ${formattedTime}
                        </div>` : ''
                    }
                </div>
                <span class="booking-status mobile ${isAvailable ? 'status-available' : 'status-unavailable'}">
                    <i class="fas ${isAvailable ? 'fa-check-circle' : 'fa-times-circle'}"></i>
                    ${isAvailable ? 'Available' : 'Not Available'}
                </span>
            </div>

            <div class="match-card-teams">
                <div class="team-row">
                    <div class="home-team">
                        <i class="fas fa-home"></i>
                        <span>${match.home_team || 'TBD'}</span>
                    </div>
                    <div class="away-team">
                        <i class="fas fa-plane"></i>
                        <span>${match.away_team || 'TBD'}</span>
                    </div>
                </div>
            </div>

            <div class="match-card-venue">
                <i class="fas fa-map-marker-alt"></i>
                <div class="venue-details">
                    <div class="venue-name">${match.venue || 'TBD'}</div>
                    <div class="stadium-name">${match.stadium || 'TBD'}</div>
                </div>
            </div>

            <div class="match-card-actions ${isAvailable ? 'single-action' : ''}">
                ${match.booking_url ? 
                    `<a href="${match.booking_url}" target="_blank" class="btn btn-primary book-now-btn">
                        <i class="fas fa-ticket-alt me-2"></i>
                        Book Now
                    </a>` :
                    `<button class="btn btn-secondary" disabled>
                        <i class="fas fa-clock me-2"></i>
                        Not Available
                    </button>`
                }
                ${isAvailable ? '' : 
                    `<button class="btn ${match.notification_subscribed ? 'btn-success' : 'btn-outline-primary'} subscribe-btn" 
                            data-match-id="${match.match_id}"
                            onclick="handleSubscription(${match.match_id})">
                        <i class="fas ${match.notification_subscribed ? 'fa-bell' : 'fa-bell-slash'} me-2"></i>
                        ${match.notification_subscribed ? 'Subscribed' : 'Get Updates'}
                    </button>`
                }
            </div>
        `;
        tbody.appendChild(card);
    });
}

function updateFilters(matches) {
    const venues = new Set();
    const teams = new Set();

    matches.forEach(match => {
        // Only add valid venue and team names (skip null/undefined values)
        if (match.venue) venues.add(match.venue);
        if (match.home_team) teams.add(match.home_team);
        if (match.away_team) teams.add(match.away_team);
    });

    // Remove any empty values from the sets
    venues.delete('');
    venues.delete(null);
    venues.delete(undefined);
    teams.delete('');
    teams.delete(null);
    teams.delete(undefined);

    populateFilter('venueFilter', Array.from(venues));
    populateFilter('teamFilter', Array.from(teams));
}

function populateFilter(filterId, options) {
    const filter = document.getElementById(filterId);
    if (!filter) {
        console.error(`Filter element with ID ${filterId} not found`);
        return;
    }
    
    // Save current value to restore after populating
    const currentValue = filter.value;
    
    // Clear and populate filter options
    filter.innerHTML = `<option value="">All ${filterId.replace('Filter', 's')}</option>`;
    
    // Sort and add options
    options.sort().forEach(option => {
        if (option && option.trim() !== '') {
            filter.innerHTML += `<option value="${option}">${option}</option>`;
        }
    });
    
    // Restore previous value if it exists in the new options
    const optionExists = Array.from(filter.options).some(opt => opt.value === currentValue);
    filter.value = optionExists ? currentValue : '';
    
    // If the value changed, trigger filtering
    if (filter.value !== currentValue) {
        filterMatches();
    }
}

function filterMatches() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const selectedVenue = document.getElementById('venueFilter').value;
    const selectedTeam = document.getElementById('teamFilter').value;

    // Get all match elements (both desktop rows and mobile cards)
    const desktopRows = document.querySelectorAll('#matchesTable tbody tr.desktop-only');
    const mobileCards = document.querySelectorAll('#matchesTable tbody .mobile-only.match-card');
    
    // Create arrays for iteration
    const desktopElements = Array.from(desktopRows);
    const mobileElements = Array.from(mobileCards);
    
    // Safety check - if no elements or mismatched counts, abort
    if (desktopElements.length === 0 || mobileElements.length === 0) {
        console.warn('No match elements found or DOM not ready yet');
        return;
    }
    
    if (desktopElements.length !== mobileElements.length) {
        console.warn('Mismatched number of desktop and mobile elements');
    }
    
    // Track visible matches for stats
    let visibleMatchCount = 0;
    
    // Process each match (using desktop view for data extraction)
    const elementsToProcess = Math.min(desktopElements.length, mobileElements.length);
    for (let i = 0; i < elementsToProcess; i++) {
        const desktopRow = desktopElements[i];
        const mobileCard = mobileElements[i];
        
        try {
            // Extract data from desktop row for filtering
            const venue = desktopRow.querySelector('td:nth-child(4)')?.textContent || '';
            const teams = desktopRow.querySelector('.teams-container')?.textContent || '';
            const searchText = desktopRow.textContent.toLowerCase();
            
            // Apply filters
            const matchesSearch = searchTerm === '' || searchText.includes(searchTerm);
            const matchesVenue = selectedVenue === '' || venue.includes(selectedVenue);
            const matchesTeam = selectedTeam === '' || teams.includes(selectedTeam);
            
            // Determine if match should be shown
            const shouldShow = matchesSearch && matchesVenue && matchesTeam;
            
            // Apply visibility using CSS classes instead of inline styles
            if (shouldShow) {
                desktopRow.classList.remove('filtered-out');
                mobileCard.classList.remove('filtered-out');
                visibleMatchCount++;
            } else {
                desktopRow.classList.add('filtered-out');
                mobileCard.classList.add('filtered-out');
            }
        } catch (err) {
            console.error('Error filtering match:', err);
        }
    }
    
    // Update match count after filtering
    updateFilteredMatchCount(visibleMatchCount);
    
    // Log for debugging
    console.log(`Filtered matches: ${visibleMatchCount} of ${elementsToProcess} total`);
}

function updateFilteredMatchCount(visibleCount) {
    // Update the total matches count
    const totalMatches = document.getElementById('totalMatches');
    if (totalMatches) {
        totalMatches.textContent = visibleCount || 0;
    }
}

// Add window resize listener to update count when switching between views
window.addEventListener('resize', updateFilteredMatchCount);

// Date and Time formatting functions
function formatDate(dateString) {
    try {
        if (!dateString) return 'TBD';
        
        // Check if it's a valid date
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'TBD';
        
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch (error) {
        console.error('Error formatting date:', error);
        return 'TBD';
    }
}

function formatTime(timeString) {
    try {
        if (!timeString) return 'TBD';
        
        // If it's already a formatted time string, return it
        if (timeString.includes(':') && (timeString.includes('AM') || timeString.includes('PM') || timeString.includes('am') || timeString.includes('pm'))) {
            return timeString;
        }
        
        // Try to parse as date object
        const date = new Date(timeString);
        if (!isNaN(date.getTime())) {
            return date.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
            });
        }
        
        // Otherwise, return TBD
        return 'TBD';
    } catch (error) {
        console.error('Error formatting time:', error);
        return 'TBD';
    }
}

function getBookingStatusHTML(status) {
    // Use our helper function to determine availability
    const isAvailable = isBookingAvailable(status);
    
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
    // Get both desktop and mobile buttons for this match
    const buttons = document.querySelectorAll(`.subscribe-btn[data-match-id="${matchId}"]`);
    
    // Show loading state on all buttons
    buttons.forEach(btn => {
        btn.disabled = true;
        const originalWidth = btn.offsetWidth;
        btn.style.width = `${originalWidth}px`; // Maintain button width during loading
        btn.innerHTML = `
            <div class="d-flex align-items-center justify-content-center">
                <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                <span class="ms-2">Subscribing...</span>
            </div>
        `;
    });

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
            // Update all buttons state
            buttons.forEach(btn => {
                btn.disabled = false;
                btn.style.width = ''; // Reset width
                btn.classList.remove('btn-outline-primary');
                btn.classList.add('btn-success');
                btn.innerHTML = `
                    <div class="d-flex align-items-center justify-content-center">
                        <i class="fas fa-bell"></i>
                        <span class="ms-2">Subscribed</span>
                    </div>
                `;
            });
            
            showToast('Success', 'Successfully subscribed to match notifications!', 'success');
        } else {
            throw new Error(data.message || 'Subscription failed');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        // Reset all buttons state
        buttons.forEach(btn => {
            btn.disabled = false;
            btn.style.width = ''; // Reset width
            btn.classList.remove('btn-success');
            btn.classList.add('btn-outline-primary');
            btn.innerHTML = `
                <div class="d-flex align-items-center justify-content-center">
                    <i class="fas fa-bell-slash"></i>
                    <span class="ms-2">Get Updates</span>
                </div>
            `;
        });
        
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

function createMatchRow(match, index) {
    const tr = document.createElement('tr');
    
    // Desktop View
    tr.innerHTML = `
        <td>${match.match_id}</td>
        <td>
            <div class="date-time-container">
                <span class="date">${formatDate(match.date)}</span>
                <span class="time">${formatTime(match.time)}</span>
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
            <span class="booking-status ${match.booking_status === 'Available' ? 'status-available' : 'status-unavailable'}">
                <i class="fas ${match.booking_status === 'Available' ? 'fa-check-circle' : 'fa-times-circle'}"></i>
                ${match.booking_status}
            </span>
        </td>
        <td>
            <button class="btn btn-primary btn-sm book-now-btn" ${match.booking_status !== 'Available' ? 'disabled' : ''}>
                Book Now
            </button>
        </td>
        <td>
            <button class="btn ${match.subscribed ? 'btn-success' : 'btn-outline-primary'} btn-sm subscribe-btn" data-match-id="${match.match_id}">
                ${match.subscribed ? 'Subscribed' : 'Subscribe'}
            </button>
        </td>
    `;

    // Mobile View (Cards) - Updated Layout with Better Design
    tr.innerHTML += `
        <div class="mobile-card">
            <div class="mobile-card-header">
                <div class="match-meta">
                    <div class="match-number">
                        #${match.match_id}
                        <span class="match-date-short">
                            <i class="far fa-calendar-alt"></i>
                            ${formatDateShort(match.date)}
                        </span>
                    </div>
                    ${formattedTime ? 
                        `<div class="match-time">
                            <i class="far fa-clock"></i>
                            ${formattedTime}
                        </div>` : ''
                    }
                </div>
                <span class="booking-status mobile ${match.booking_status === true ? 'status-opened' : match.booking_status === null ? 'status-closed' : 'status-not-opened'}">
                    <i class="fas ${match.booking_status === true ? 'fa-check-circle' : 'fa-times-circle'}"></i>
                    ${match.booking_status === true ? 'Opened' : match.booking_status === null ? 'Closed' : 'Not opened'}
                </span>
            </div>

            <div class="match-card-teams">
                <div class="team-row home">
                    <i class="fas fa-home"></i>
                    <span>${match.team1}</span>
                </div>
                <div class="vs-badge">VS</div>
                <div class="team-row away">
                    <i class="fas fa-plane"></i>
                    <span>${match.team2}</span>
                </div>
            </div>

            <div class="match-card-venue">
                <i class="fas fa-map-marker-alt"></i>
                <div class="venue-details">
                    <div class="venue-name">${match.venue}</div>
                    <div class="stadium-name">${match.stadium}</div>
                </div>
            </div>

            <div class="match-card-actions">
                <button class="btn btn-primary book-now-btn mobile" ${match.booking_status !== 'Available' ? 'disabled' : ''}>
                    <i class="fas fa-ticket-alt"></i>
                    Book Now
                </button>
                <button class="btn ${match.subscribed ? 'btn-success' : 'btn-outline-primary'} subscribe-btn mobile" 
                        data-match-id="${match.match_id}">
                    <i class="fas ${match.subscribed ? 'fa-bell' : 'fa-bell-slash'}"></i>
                    ${match.subscribed ? 'Subscribed' : 'Get Updates'}
                </button>
            </div>
        </div>
    `;

    return tr;
}

// Add these helper functions if not already present
function formatDateShort(dateString) {
    try {
        if (!dateString) return 'TBD';
        
        // Check if it's a valid date
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'TBD';
        
        // Format without year
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });
    } catch (error) {
        console.error('Error formatting date:', error);
        return 'TBD';
    }
}

function formatTime(timeString) {
    return timeString;
}

// Helper functions for generating HTML
function getBookingButtonHTML(match) {
    // Only show Book Now button if booking is available and URL exists
    const isAvailable = isBookingAvailable(match.booking_status);
    
    return (isAvailable && match.booking_url) ? 
        `<a href="${match.booking_url}" 
            target="_blank" 
            class="btn btn-sm btn-outline-primary book-now-btn">
            <i class="fas fa-external-link-alt me-1"></i>
            Book Now
        </a>` : 
        `<button class="btn btn-sm btn-outline-secondary" disabled>
            <i class="fas fa-clock me-1"></i>
            ${isAvailable ? 'Coming Soon' : 'Not Available'}
        </button>`;
}

function getSubscribeButtonHTML(match) {
    return `
        <button class="btn btn-sm ${match.notification_subscribed ? 'btn-success' : 'btn-outline-primary'} subscribe-btn"
                data-match-id="${match.match_id}"
                onclick="handleSubscription(${match.match_id})">
            <i class="fas ${match.notification_subscribed ? 'fa-bell' : 'fa-bell-slash'} me-1"></i>
            ${match.notification_subscribed ? 'Subscribed' : 'Subscribe'}
        </button>
    `;
}

/**
 * Helper function to check if a booking status value indicates availability
 * @param {any} status - The booking status value from the data
 * @return {boolean} - True if the status indicates availability, false otherwise
 */
function isBookingAvailable(status) {
    return status === true || 
           status === 'true' || 
           status === 'TRUE' || 
           status === 'True' || 
           status === 'Available' || 
           status === 'AVAILABLE' || 
           status === 1 || 
           status === '1';
}