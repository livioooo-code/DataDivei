document.addEventListener('DOMContentLoaded', function() {
    // Initialize variables
    let map;
    let startMarker, endMarker, movingMarker;
    let waypointMarkers = [];
    let routePath, animatedPath;
    let routeCoordinates = [];
    let animationInterval;
    let currentAnimationIndex = 0;
    let isAnimationRunning = false;
    let locationWatchId = null;
    let currentLocationMarker = null;
    let waypointCounter = 0;
    let currentRouteData = null; // Store the current route data
    let routeSegmentLayers = []; // Store route segments with traffic colors
    let currentRouteId = null; // Current route ID for traffic updates
    let animationEffects = ['bounce', 'pulse', 'car', 'motorcycle', 'bicycle']; // Animation effect types
    let currentAnimationEffect = 'car'; // Default animation effect
    let animationTrail = []; // Trail effect markers
    let achievementUnlocked = false; // For achievement animations
    let speedMilestones = []; // Track speed milestones for achievements
    
    // Initialize map centered on a default location
    initMap();
    
    // Load saved routes
    loadSavedRoutes();
    
    // Set up event listeners
    document.getElementById('calculateRoute').addEventListener('click', calculateRoute);
    document.getElementById('startAnimation').addEventListener('click', startAnimation);
    document.getElementById('pauseAnimation').addEventListener('click', pauseAnimation);
    document.getElementById('resetAnimation').addEventListener('click', resetAnimation);
    document.getElementById('animationSpeed').addEventListener('input', updateAnimationSpeed);
    document.getElementById('animationEffect').addEventListener('change', updateAnimationEffect);
    document.getElementById('saveRoute').addEventListener('click', saveCurrentRoute);
    document.getElementById('openInGoogleMaps').addEventListener('click', openInGoogleMaps);
    
    // Add location tracking button listeners
    document.getElementById('getCurrentLocation').addEventListener('click', getCurrentLocation);
    document.getElementById('useCurrentLocationStart').addEventListener('click', function() {
        useCurrentLocationFor('start');
    });
    document.getElementById('useCurrentLocationEnd').addEventListener('click', function() {
        useCurrentLocationFor('end');
    });
    document.getElementById('stopLocationTracking').addEventListener('click', stopLocationTracking);
    
    // Add waypoint button listeners
    document.getElementById('addWaypoint').addEventListener('click', addWaypoint);
    document.getElementById('optimizeWaypoints').addEventListener('click', function() {
        calculateRoute(true); // true for optimization
    });
    
    // Set up address/coordinate input fields
    const startInput = document.getElementById('startLocation');
    const endInput = document.getElementById('endLocation');
    
    // Add search button next to start input
    const startSearchBtn = document.getElementById('searchStartAddress');
    startSearchBtn.addEventListener('click', function() {
        const address = startInput.value;
        if (address && address.trim() !== '') {
            geocodeAddress(address, 'startLocation', setStartPoint);
        }
    });
    
    // Add search button next to end input
    const endSearchBtn = document.getElementById('searchEndAddress');
    endSearchBtn.addEventListener('click', function() {
        const address = endInput.value;
        if (address && address.trim() !== '') {
            geocodeAddress(address, 'endLocation', setEndPoint);
        }
    });
    
    // Handle Enter key press in input fields
    startInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            startSearchBtn.click();
        }
    });
    
    endInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            endSearchBtn.click();
        }
    });
    
    // Legacy support for direct coordinate input
    startInput.addEventListener('change', function() {
        const coords = parseCoordinates(this.value);
        if (coords) {
            setStartPoint(coords[0], coords[1]);
        }
    });
    
    endInput.addEventListener('change', function() {
        const coords = parseCoordinates(this.value);
        if (coords) {
            setEndPoint(coords[0], coords[1]);
        }
    });

    /**
     * Initialize the map
     */
    function initMap() {
        // Create map centered on New York City by default
        map = L.map('map').setView([40.7128, -74.0060], 12);
        
        // Add OpenStreetMap tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap contributors</a>'
        }).addTo(map);
        
        // Add click handler for setting start/end points and waypoints
        map.on('click', function(e) {
            if (!startMarker) {
                setStartPoint(e.latlng.lat, e.latlng.lng);
            } else if (!endMarker) {
                setEndPoint(e.latlng.lat, e.latlng.lng);
            } else {
                // If both start and end are set, add a waypoint
                addWaypointAt(e.latlng.lat, e.latlng.lng);
            }
        });
    }
    
    /**
     * Set the start point of the route
     */
    function setStartPoint(lat, lng) {
        // Remove existing marker if it exists
        if (startMarker) {
            map.removeLayer(startMarker);
        }
        
        // Create a new marker
        startMarker = L.marker([lat, lng], {
            draggable: true,
            title: "Start Point",
            icon: L.divIcon({
                html: '<i class="fas fa-play-circle start-marker-icon"></i>',
                iconSize: [30, 30],
                className: 'custom-div-icon'
            })
        }).addTo(map);
        
        // Update input field
        document.getElementById('startLocation').value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        
        // Add drag end handler
        startMarker.on('dragend', function() {
            const newPos = startMarker.getLatLng();
            document.getElementById('startLocation').value = `${newPos.lat.toFixed(6)}, ${newPos.lng.toFixed(6)}`;
            clearRoute();
        });
        
        // Clear route when changing start point
        clearRoute();
    }
    
    /**
     * Set the end point of the route
     */
    function setEndPoint(lat, lng) {
        // Remove existing marker if it exists
        if (endMarker) {
            map.removeLayer(endMarker);
        }
        
        // Create a new marker
        endMarker = L.marker([lat, lng], {
            draggable: true,
            title: "End Point",
            icon: L.divIcon({
                html: '<i class="fas fa-flag-checkered end-marker-icon"></i>',
                iconSize: [30, 30],
                className: 'custom-div-icon'
            })
        }).addTo(map);
        
        // Update input field
        document.getElementById('endLocation').value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        
        // Add drag end handler
        endMarker.on('dragend', function() {
            const newPos = endMarker.getLatLng();
            document.getElementById('endLocation').value = `${newPos.lat.toFixed(6)}, ${newPos.lng.toFixed(6)}`;
            clearRoute();
        });
        
        // Clear route when changing end point
        clearRoute();
    }
    
    /**
     * Parse coordinates from a string
     */
    function parseCoordinates(coordString) {
        // Expecting format: "lat, lng" or "lat,lng"
        const parts = coordString.split(',');
        if (parts.length === 2) {
            const lat = parseFloat(parts[0].trim());
            const lng = parseFloat(parts[1].trim());
            if (!isNaN(lat) && !isNaN(lng)) {
                return [lat, lng];
            }
        }
        return null;
    }
    
    /**
     * Geocode address using backend API
     */
    function geocodeAddress(addressString, targetElementId, callback) {
        // Show loading state
        const targetElement = document.getElementById(targetElementId);
        const originalValue = targetElement.value;
        targetElement.value = "Szukam adresu...";
        targetElement.disabled = true;
        
        // Call the geocoding API
        fetch(`/api/geocode?query=${encodeURIComponent(addressString)}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                targetElement.disabled = false;
                
                if (data.length > 0) {
                    // Use the first (best) result
                    const location = data[0];
                    const coords = [location.lat, location.lng];
                    
                    // Update the input field with formatted address
                    targetElement.value = location.display_name;
                    
                    // Call the callback with coordinates
                    if (callback && typeof callback === 'function') {
                        callback(coords[0], coords[1]);
                    }
                } else {
                    // No results found
                    targetElement.value = originalValue;
                    alert('Nie znaleziono podanego adresu. Spróbuj podać bardziej dokładny adres.');
                }
            })
            .catch(error => {
                console.error('Error geocoding address:', error);
                targetElement.disabled = false;
                targetElement.value = originalValue;
                alert('Wystąpił błąd podczas wyszukiwania adresu. Spróbuj ponownie.');
            });
    }
    
    /**
     * Add a new empty waypoint to the route
     */
    function addWaypoint() {
        waypointCounter++;
        const waypointId = `waypoint-${waypointCounter}`;
        
        // Create waypoint container
        const waypointDiv = document.createElement('div');
        waypointDiv.className = 'mb-3 waypoint-container';
        waypointDiv.id = waypointId + '-container';
        
        // Create label
        const label = document.createElement('label');
        label.className = 'form-label d-flex justify-content-between align-items-center';
        label.innerHTML = `<span>Punkt pośredni ${waypointCounter}</span>`;
        
        // Create delete button in label
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-sm btn-outline-danger';
        deleteBtn.type = 'button';
        deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
        deleteBtn.onclick = function() {
            removeWaypoint(waypointId);
        };
        label.appendChild(deleteBtn);
        
        // Create input group
        const inputGroup = document.createElement('div');
        inputGroup.className = 'input-group';
        
        // Create input group text (icon)
        const inputGroupText = document.createElement('span');
        inputGroupText.className = 'input-group-text';
        inputGroupText.innerHTML = '<i class="fas fa-map-pin"></i>';
        
        // Create input
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'form-control waypoint-input';
        input.id = waypointId;
        input.placeholder = 'Wpisz adres lub współrzędne';
        input.dataset.waypointId = waypointCounter;
        
        // Create search button
        const searchBtn = document.createElement('button');
        searchBtn.className = 'btn btn-outline-primary';
        searchBtn.type = 'button';
        searchBtn.innerHTML = '<i class="fas fa-search"></i>';
        searchBtn.onclick = function() {
            const address = input.value;
            if (address && address.trim() !== '') {
                geocodeAddress(address, waypointId, function(lat, lng) {
                    updateWaypointMarker(waypointId, lat, lng);
                });
            }
        };
        
        // Add Enter key press handler
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                searchBtn.click();
            }
        });
        
        // Add change event to input for legacy coordinate support
        input.addEventListener('change', function() {
            const coords = parseCoordinates(this.value);
            if (coords) {
                updateWaypointMarker(waypointId, coords[0], coords[1]);
            }
        });
        
        // Assemble the elements
        inputGroup.appendChild(inputGroupText);
        inputGroup.appendChild(input);
        inputGroup.appendChild(searchBtn);
        waypointDiv.appendChild(label);
        waypointDiv.appendChild(inputGroup);
        
        // Add to the container
        document.getElementById('waypointsContainer').appendChild(waypointDiv);
        
        // Enable optimize button if we have any waypoints
        document.getElementById('optimizeWaypoints').disabled = false;
        
        // Return the waypoint ID for reference
        return waypointId;
    }
    
    /**
     * Add a waypoint at specific coordinates
     */
    function addWaypointAt(lat, lng) {
        const waypointId = addWaypoint();
        updateWaypointMarker(waypointId, lat, lng);
        
        // Update input field
        document.getElementById(waypointId).value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
    
    /**
     * Update or create a waypoint marker
     */
    function updateWaypointMarker(waypointId, lat, lng) {
        // Find existing marker if there is one
        let marker = waypointMarkers.find(m => m.id === waypointId);
        
        // Remove existing marker if it exists
        if (marker) {
            map.removeLayer(marker.marker);
            waypointMarkers = waypointMarkers.filter(m => m.id !== waypointId);
        }
        
        // Create a new marker
        const waypointMarker = L.marker([lat, lng], {
            draggable: true,
            title: `Waypoint ${waypointId}`,
            icon: L.divIcon({
                html: `<i class="fas fa-map-pin" style="color: #fd7e14; font-size: 20px;"></i>`,
                iconSize: [30, 30],
                className: 'custom-div-icon'
            })
        }).addTo(map);
        
        // Store reference to this marker
        waypointMarkers.push({
            id: waypointId,
            marker: waypointMarker
        });
        
        // Add drag end handler
        waypointMarker.on('dragend', function() {
            const newPos = waypointMarker.getLatLng();
            document.getElementById(waypointId).value = `${newPos.lat.toFixed(6)}, ${newPos.lng.toFixed(6)}`;
            clearRoute();
        });
        
        // Clear route when changing waypoint
        clearRoute();
    }
    
    /**
     * Remove a waypoint
     */
    function removeWaypoint(waypointId) {
        // Remove marker from map
        const marker = waypointMarkers.find(m => m.id === waypointId);
        if (marker) {
            map.removeLayer(marker.marker);
            waypointMarkers = waypointMarkers.filter(m => m.id !== waypointId);
        }
        
        // Remove waypoint container from DOM
        const container = document.getElementById(waypointId + '-container');
        if (container) {
            container.remove();
        }
        
        // Disable optimize button if no waypoints remain
        if (waypointMarkers.length === 0) {
            document.getElementById('optimizeWaypoints').disabled = true;
        }
        
        // Clear route when removing waypoint
        clearRoute();
    }
    
    /**
     * Calculate the route with waypoints
     */
    function calculateRoute(optimize = false) {
        // Check if we have both start and end points
        if (!startMarker || !endMarker) {
            alert('Please set both start and end points');
            return;
        }
        
        // Clear any existing route
        clearRoute();
        
        // Show loading state
        document.getElementById('calculateRoute').innerHTML = '<span class="spinner-border spinner-border-sm"></span> Obliczanie...';
        document.getElementById('calculateRoute').disabled = true;
        
        // Get coordinates
        const startLatLng = startMarker.getLatLng();
        const endLatLng = endMarker.getLatLng();
        
        // Collect waypoints
        const waypoints = waypointMarkers.map(m => {
            const pos = m.marker.getLatLng();
            return [pos.lat, pos.lng];
        });
        
        // Fetch route from backend
        fetch('/api/directions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                start: [startLatLng.lat, startLatLng.lng],
                end: [endLatLng.lat, endLatLng.lng],
                waypoints: waypoints,
                optimize: optimize,
                include_traffic: true
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            // Reset button state
            document.getElementById('calculateRoute').innerHTML = '<i class="fas fa-route me-2"></i>Oblicz trasę';
            document.getElementById('calculateRoute').disabled = false;
            
            // Process the route
            if (data.route && data.route.length > 0) {
                // Store route coordinates
                routeCoordinates = data.route.map(point => [point[0], point[1]]);
                
                // Store route ID for traffic updates
                if (data.route_id) {
                    currentRouteId = data.route_id;
                }
                
                // Store current route data
                currentRouteData = {
                    encoded_polyline: data.encoded_polyline,
                    distance: data.distance,
                    duration: data.duration,
                    base_duration: data.base_duration,
                    traffic_delay: data.traffic_delay,
                    has_traffic_data: data.has_traffic_data
                };
                
                // Draw the route on the map with traffic information
                if (data.has_traffic_data && data.route_segments) {
                    drawRouteWithTraffic(routeCoordinates, data.route_segments);
                } else {
                    drawRoute(routeCoordinates);
                }
                
                // Update route info
                document.querySelector('.route-info').style.display = 'block';
                document.getElementById('routeDistance').textContent = formatDistance(data.distance);
                document.getElementById('routeDuration').textContent = formatDuration(data.duration);
                
                // Show traffic information if available
                if (data.has_traffic_data && data.traffic_delay > 0) {
                    document.querySelector('.traffic-info').style.display = 'flex';
                    document.getElementById('trafficDelay').textContent = data.traffic_delay_text || `+${Math.round(data.traffic_delay / 60)} min`;
                    
                    // Show traffic conditions
                    showTrafficConditions(data.traffic_conditions, data.avg_traffic_level);
                    
                    // Add traffic update button listener
                    document.getElementById('checkTrafficUpdates').addEventListener('click', checkTrafficUpdates);
                }
                
                // Enable animation controls
                document.getElementById('startAnimation').disabled = false;
                document.getElementById('pauseAnimation').disabled = true;
                document.getElementById('resetAnimation').disabled = false;
                
                // Fit map to show the entire route
                const bounds = L.latLngBounds(routeCoordinates);
                map.fitBounds(bounds, { padding: [50, 50] });
            } else {
                alert('Nie znaleziono trasy między wybranymi punktami');
            }
        })
        .catch(error => {
            console.error('Error calculating route:', error);
            document.getElementById('calculateRoute').innerHTML = '<i class="fas fa-route me-2"></i>Oblicz trasę';
            document.getElementById('calculateRoute').disabled = false;
            alert('Wystąpił błąd podczas obliczania trasy. Spróbuj ponownie.');
        });
    }
    
    /**
     * Draw route on the map with traffic information
     */
    function drawRouteWithTraffic(coordinates, segments) {
        // Clear any existing route segments
        for (let i = 0; i < routeSegmentLayers.length; i++) {
            map.removeLayer(routeSegmentLayers[i]);
        }
        routeSegmentLayers = [];
        
        // Draw segments with traffic colors
        if (segments && segments.length > 0) {
            segments.forEach(segment => {
                if (segment.coordinates && segment.coordinates.length > 1) {
                    // Determine traffic color based on level
                    let colorClass = 'route-segment-green'; // Default
                    
                    if (segment.traffic_level === 1) {
                        colorClass = 'route-segment-yellow';
                    } else if (segment.traffic_level === 2) {
                        colorClass = 'route-segment-orange';
                    } else if (segment.traffic_level === 3) {
                        colorClass = 'route-segment-red';
                    }
                    
                    // Create segment polyline
                    const segmentLayer = L.polyline(segment.coordinates, {
                        className: colorClass
                    }).addTo(map);
                    
                    // Store reference to segment layer
                    routeSegmentLayers.push(segmentLayer);
                }
            });
        } else {
            // Fallback to regular route drawing if no segments
            drawRoute(coordinates);
        }
        
        // Create animated path (initially empty)
        animatedPath = L.polyline([], {
            color: '#007bff',
            weight: 6,
            opacity: 1,
            className: 'animated-route-path'
        }).addTo(map);
        
        // Create the moving marker
        movingMarker = L.marker(coordinates[0], {
            icon: L.divIcon({
                className: 'animated-marker',
                iconSize: [15, 15]
            })
        }).addTo(map);
        
        // Enable Google Maps button
        document.getElementById('openInGoogleMaps').disabled = false;
    }
    
    /**
     * Show traffic conditions in the UI
     */
    function showTrafficConditions(conditions, avgLevel) {
        const trafficContainer = document.querySelector('.traffic-conditions');
        const segmentsContainer = document.getElementById('trafficSegments');
        
        // Show traffic container
        trafficContainer.style.display = 'block';
        
        // Update traffic level indicator
        updateTrafficLevelIndicator(avgLevel);
        
        // Add individual segments if available
        if (conditions && conditions.length > 0) {
            segmentsContainer.innerHTML = '';
            
            conditions.forEach((condition, index) => {
                if (condition.level > 0) { // Only show segments with traffic
                    const segmentDiv = document.createElement('div');
                    segmentDiv.className = 'traffic-segment';
                    
                    const indicator = document.createElement('span');
                    indicator.className = 'traffic-segment-indicator ' + condition.color;
                    
                    const text = document.createElement('span');
                    text.className = 'traffic-segment-text';
                    text.textContent = `Segment ${index + 1}: ${condition.delay_seconds > 0 ? '+' + Math.round(condition.delay_seconds / 60) + ' min' : 'Brak opóźnień'}`;
                    
                    segmentDiv.appendChild(indicator);
                    segmentDiv.appendChild(text);
                    segmentsContainer.appendChild(segmentDiv);
                }
            });
        }
    }
    
    /**
     * Update traffic level indicator
     */
    function updateTrafficLevelIndicator(level) {
        // Reset all indicators
        const bars = document.querySelectorAll('.traffic-level-bar');
        bars.forEach(bar => bar.classList.remove('active'));
        
        // Calculate number of active bars based on traffic level (0-3)
        const activeBarCount = Math.min(Math.ceil(level), 3);
        
        // Activate appropriate bars
        for (let i = 0; i < activeBarCount; i++) {
            const bar = document.querySelector(`.traffic-level-bar[data-level="${i+1}"]`);
            if (bar) {
                bar.classList.add('active');
            }
        }
    }
    
    /**
     * Check for traffic updates
     */
    function checkTrafficUpdates() {
        if (!currentRouteId) {
            return;
        }
        
        const updateButton = document.getElementById('checkTrafficUpdates');
        updateButton.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Sprawdzanie...';
        updateButton.disabled = true;
        
        fetch('/api/traffic/check', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                route_id: currentRouteId
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            updateButton.innerHTML = '<i class="fas fa-sync-alt me-1"></i>Aktualizuj dane o ruchu';
            updateButton.disabled = false;
            
            if (data.has_updates) {
                // Update route info with new traffic data
                document.getElementById('routeDuration').textContent = formatDuration(data.new_duration);
                document.getElementById('trafficDelay').textContent = data.traffic_delay_text;
                
                // Show alert about traffic change
                const changeDirection = data.duration_change_pct > 0 ? 'dłuższy' : 'krótszy';
                const changeAmount = Math.abs(Math.round(data.duration_change_pct));
                alert(`Aktualizacja ruchu: czas podróży jest teraz ${changeDirection} o ${changeAmount}%.
                    ${data.update_reason}`);
                
                // Update traffic level indicators and segments
                updateTrafficLevelIndicator(data.avg_traffic_level);
                showTrafficConditions(data.traffic_conditions, data.avg_traffic_level);
                
                // Update stored route data
                currentRouteData.duration = data.new_duration;
                currentRouteData.traffic_delay = data.traffic_delay;
            } else {
                alert('Brak zmian w ruchu drogowym od ostatniego sprawdzenia.');
            }
        })
        .catch(error => {
            console.error('Error checking traffic updates:', error);
            updateButton.innerHTML = '<i class="fas fa-sync-alt me-1"></i>Aktualizuj dane o ruchu';
            updateButton.disabled = false;
            alert('Błąd podczas sprawdzania aktualizacji ruchu.');
        });
    }
    
    /**
     * Draw the route on the map
     */
    function drawRoute(coordinates) {
        // Create the main route path
        routePath = L.polyline(coordinates, {
            color: '#5cb85c',
            weight: 5,
            opacity: 0.7,
            className: 'route-path'
        }).addTo(map);
        
        // Create animated path (initially empty)
        animatedPath = L.polyline([], {
            color: '#007bff',
            weight: 6,
            opacity: 1,
            className: 'animated-route-path'
        }).addTo(map);
        
        // Create the moving marker
        movingMarker = L.marker(coordinates[0], {
            icon: L.divIcon({
                className: 'animated-marker',
                iconSize: [15, 15]
            })
        }).addTo(map);
        
        // Enable Google Maps button
        document.getElementById('openInGoogleMaps').disabled = false;
    }
    
    /**
     * Open the current route in Google Maps
     */
    function openInGoogleMaps() {
        if (!startMarker || !endMarker) {
            alert('Najpierw ustaw punkty początkowy i końcowy');
            return;
        }
        
        const startLatLng = startMarker.getLatLng();
        const endLatLng = endMarker.getLatLng();
        
        // Collect waypoints
        const waypointCoords = waypointMarkers.map(m => {
            const pos = m.marker.getLatLng();
            return `${pos.lat},${pos.lng}`;
        });
        
        // Build Google Maps URL
        let googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${startLatLng.lat},${startLatLng.lng}&destination=${endLatLng.lat},${endLatLng.lng}`;
        
        // Add waypoints if there are any
        if (waypointCoords.length > 0) {
            googleMapsUrl += `&waypoints=${waypointCoords.join('|')}`;
        }
        
        // Open in new tab
        window.open(googleMapsUrl, '_blank');
    }
    
    /**
     * Mark a waypoint as visited and remove it from the route
     */
    function markWaypointVisited(waypointIndex) {
        if (waypointIndex < 0 || waypointIndex >= waypointMarkers.length) {
            return false;
        }
        
        // Get the waypoint to remove
        const waypoint = waypointMarkers[waypointIndex];
        
        // Remove it from the map and array
        removeWaypoint(waypoint.id);
        
        // Recalculate the route if there are still points
        if (startMarker && endMarker) {
            calculateRoute(false);
        }
        
        return true;
    }
    
    /**
     * Start the route animation
     */
    function startAnimation() {
        if (!routeCoordinates.length) return;
        
        // Update UI
        document.getElementById('startAnimation').disabled = true;
        document.getElementById('pauseAnimation').disabled = false;
        isAnimationRunning = true;
        
        // Reset animation trail markers
        clearAnimationTrail();
        
        // Reset milestone achievements if animating from the beginning
        if (currentAnimationIndex === 0) {
            speedMilestones = [];
        }
        
        // Create moving marker if it doesn't exist yet
        if (!movingMarker) {
            // Create a moving marker to show the animation progress
            const startPos = routeCoordinates[currentAnimationIndex];
            movingMarker = L.marker(startPos, {
                icon: getVehicleIcon(currentAnimationEffect),
                zIndexOffset: 1000
            }).addTo(map);
        }
        
        // Get animation speed
        const speed = Number(document.getElementById('animationSpeed').value);
        
        // Calculate interval based on speed and route length
        const interval = calculateAnimationInterval(speed, routeCoordinates.length);
        
        // Start animation
        animationInterval = setInterval(() => {
            // Check if we've reached the end
            if (currentAnimationIndex >= routeCoordinates.length - 1) {
                pauseAnimation();
                showAchievement("Ukończono trasę! 🎉");
                return;
            }
            
            // Move to next point
            currentAnimationIndex++;
            updateAnimation();
            
        }, interval);
    }
    
    /**
     * Pause the route animation
     */
    function pauseAnimation() {
        clearInterval(animationInterval);
        document.getElementById('startAnimation').disabled = false;
        document.getElementById('pauseAnimation').disabled = true;
        isAnimationRunning = false;
    }
    
    /**
     * Reset the route animation
     */
    function resetAnimation() {
        // Stop any running animation
        if (isAnimationRunning) {
            pauseAnimation();
        }
        
        // Reset animation index
        currentAnimationIndex = 0;
        
        // Reset milestones
        speedMilestones = [];
        
        // Clear animation trail
        clearAnimationTrail();
        
        // Update marker appearance
        if (movingMarker) {
            movingMarker.setIcon(getVehicleIcon(currentAnimationEffect));
        }
        
        // Reset animation display
        updateAnimation();
        
        // Update buttons
        document.getElementById('startAnimation').disabled = false;
        document.getElementById('resetAnimation').disabled = false;
    }
    
    /**
     * Update the animation display
     */
    function updateAnimation() {
        if (!routeCoordinates.length) return;
        
        // Update animated path
        const animatedSegment = routeCoordinates.slice(0, currentAnimationIndex + 1);
        animatedPath.setLatLngs(animatedSegment);
        
        // Update marker position
        const currentPos = routeCoordinates[currentAnimationIndex];
        
        // Apply current animation effect
        applyAnimationEffect(currentPos);
        
        // Check for progress milestones
        checkProgressMilestones();
        
        // Follow animation if enabled
        if (document.getElementById('followAnimation').checked) {
            map.panTo(currentPos);
        }
    }
    
    /**
     * Apply the current animation effect to the moving marker
     */
    function applyAnimationEffect(position) {
        // Update marker position first
        movingMarker.setLatLng(position);
        
        // Apply the selected animation effect
        switch(currentAnimationEffect) {
            case 'bounce':
                applyBounceEffect(movingMarker);
                break;
            case 'pulse':
                applyPulseEffect(movingMarker);
                break;
            case 'car':
                applyCarEffect(position);
                break;
            case 'motorcycle':
                applyMotorcycleEffect(position);
                break;
            case 'bicycle':
                applyBicycleEffect(position);
                break;
            default:
                // Default behavior - just update position
                break;
        }
        
        // Update the trail effect if using car/motorcycle/bicycle
        if (['car', 'motorcycle', 'bicycle'].includes(currentAnimationEffect)) {
            updateAnimationTrail(position);
        }
    }
    
    /**
     * Apply bounce effect to the marker
     */
    function applyBounceEffect(marker) {
        // Get the marker element
        const markerElement = marker.getElement();
        
        // Remove any existing animation classes
        markerElement.classList.remove('marker-pulse', 'marker-bounce');
        
        // Force a DOM reflow (required for CSS animations to restart)
        void markerElement.offsetWidth;
        
        // Add the bounce animation class
        markerElement.classList.add('marker-bounce');
    }
    
    /**
     * Apply pulse effect to the marker
     */
    function applyPulseEffect(marker) {
        // Get the marker element
        const markerElement = marker.getElement();
        
        // Remove any existing animation classes
        markerElement.classList.remove('marker-pulse', 'marker-bounce');
        
        // Force a DOM reflow (required for CSS animations to restart)
        void markerElement.offsetWidth;
        
        // Add the pulse animation class
        markerElement.classList.add('marker-pulse');
    }
    
    /**
     * Apply car effect (custom icon with trail)
     */
    function applyCarEffect(position) {
        // Update marker icon if needed
        if (movingMarker.getIcon().options.html !== '<i class="fas fa-car"></i>') {
            movingMarker.setIcon(L.divIcon({
                html: '<i class="fas fa-car"></i>',
                iconSize: [30, 30],
                className: 'vehicle-icon-container'
            }));
        }
    }
    
    /**
     * Apply motorcycle effect (custom icon with trail)
     */
    function applyMotorcycleEffect(position) {
        // Update marker icon if needed
        if (movingMarker.getIcon().options.html !== '<i class="fas fa-motorcycle"></i>') {
            movingMarker.setIcon(L.divIcon({
                html: '<i class="fas fa-motorcycle"></i>',
                iconSize: [30, 30],
                className: 'vehicle-icon-container'
            }));
        }
    }
    
    /**
     * Apply bicycle effect (custom icon with trail)
     */
    function applyBicycleEffect(position) {
        // Update marker icon if needed
        if (movingMarker.getIcon().options.html !== '<i class="fas fa-bicycle"></i>') {
            movingMarker.setIcon(L.divIcon({
                html: '<i class="fas fa-bicycle"></i>',
                iconSize: [30, 30],
                className: 'vehicle-icon-container'
            }));
        }
    }
    
    /**
     * Update the animation trail behind the moving marker
     */
    function updateAnimationTrail(position) {
        // Add a new trail marker
        const trailMarker = L.circleMarker(position, {
            radius: 3,
            color: getTrailColor(),
            fillColor: getTrailColor(),
            fillOpacity: 0.7,
            weight: 1
        }).addTo(map);
        
        // Add to the trail array
        animationTrail.push({
            marker: trailMarker,
            timestamp: Date.now()
        });
        
        // Limit trail length and fade out old trail markers
        manageTrailMarkers();
    }
    
    /**
     * Manage trail markers (remove old ones, fade others)
     */
    function manageTrailMarkers() {
        const now = Date.now();
        const maxTrailAge = 10000; // 10 seconds
        const maxTrailSize = 50;
        
        // Remove old trail markers
        while (animationTrail.length > 0 && 
               (now - animationTrail[0].timestamp > maxTrailAge || animationTrail.length > maxTrailSize)) {
            map.removeLayer(animationTrail[0].marker);
            animationTrail.shift();
        }
        
        // Update opacity of remaining trail markers based on age
        animationTrail.forEach((item, index) => {
            const age = now - item.timestamp;
            const opacity = Math.max(0.1, 1 - (age / maxTrailAge));
            item.marker.setStyle({ fillOpacity: opacity, opacity: opacity });
        });
    }
    
    /**
     * Get color for trail markers based on current effect
     */
    function getTrailColor() {
        switch(currentAnimationEffect) {
            case 'car':
                return '#3388ff'; // Blue
            case 'motorcycle':
                return '#ff4d4d'; // Red
            case 'bicycle':
                return '#4dff4d'; // Green
            default:
                return '#ffbb33'; // Orange
        }
    }
    
    /**
     * Clear all animation trail markers
     */
    function clearAnimationTrail() {
        // Remove all trail markers from the map
        animationTrail.forEach(item => {
            map.removeLayer(item.marker);
        });
        
        // Clear the array
        animationTrail = [];
    }
    
    /**
     * Get the appropriate vehicle icon based on effect type
     */
    function getVehicleIcon(effect) {
        let html = '<i class="fas fa-map-marker-alt"></i>';
        
        switch(effect) {
            case 'car':
                html = '<i class="fas fa-car"></i>';
                break;
            case 'motorcycle':
                html = '<i class="fas fa-motorcycle"></i>';
                break;
            case 'bicycle':
                html = '<i class="fas fa-bicycle"></i>';
                break;
            case 'bounce':
            case 'pulse':
                html = '<i class="fas fa-circle"></i>';
                break;
        }
        
        return L.divIcon({
            html: html,
            iconSize: [30, 30],
            className: 'vehicle-icon-container'
        });
    }
    
    /**
     * Check for progress milestones and trigger achievements
     */
    function checkProgressMilestones() {
        if (!routeCoordinates.length) return;
        
        // Calculate progress percentage
        const progress = (currentAnimationIndex / (routeCoordinates.length - 1)) * 100;
        
        // Define milestone percentages
        const milestones = [25, 50, 75, 100];
        
        // Check each milestone
        milestones.forEach(milestone => {
            if (progress >= milestone && !speedMilestones.includes(milestone)) {
                // Add to reached milestones
                speedMilestones.push(milestone);
                
                // Show achievement notification
                showAchievement(`Osiągnięto ${milestone}% trasy!`);
            }
        });
    }
    
    /**
     * Show achievement notification
     */
    function showAchievement(message) {
        // Create achievement notification element if it doesn't exist
        let achievementEl = document.getElementById('achievement-notification');
        if (!achievementEl) {
            achievementEl = document.createElement('div');
            achievementEl.id = 'achievement-notification';
            achievementEl.className = 'achievement-notification';
            document.body.appendChild(achievementEl);
        }
        
        // Update message and show animation
        achievementEl.textContent = message;
        achievementEl.classList.add('show-achievement');
        
        // Remove animation class after animation completes
        setTimeout(() => {
            achievementEl.classList.remove('show-achievement');
        }, 3000); // Match this to the CSS animation duration
    }
    
    /**
     * Update the animation speed
     */
    function updateAnimationSpeed() {
        if (isAnimationRunning) {
            pauseAnimation();
            startAnimation();
        }
    }
    
    /**
     * Update the animation effect
     */
    function updateAnimationEffect() {
        // Get the selected effect
        const effectSelect = document.getElementById('animationEffect');
        currentAnimationEffect = effectSelect.value;
        
        // If we have a moving marker, update its icon
        if (movingMarker) {
            movingMarker.setIcon(getVehicleIcon(currentAnimationEffect));
            
            // If animation is not running, apply the effect once
            if (!isAnimationRunning && routeCoordinates.length > 0) {
                applyAnimationEffect(movingMarker.getLatLng());
            }
        }
        
        // Clear animation trail when changing effect
        clearAnimationTrail();
        
        // If animation is running, update with new effect
        if (isAnimationRunning) {
            pauseAnimation();
            startAnimation();
        }
        
        // Show achievement for changing animation style
        showAchievement(`Zmieniono styl animacji na: ${getEffectDisplayName(currentAnimationEffect)}!`);
    }
    
    /**
     * Get user-friendly name for animation effect
     */
    function getEffectDisplayName(effect) {
        const effectNames = {
            'car': 'Samochód',
            'motorcycle': 'Motocykl',
            'bicycle': 'Rower',
            'bounce': 'Odbijający punkt',
            'pulse': 'Pulsujący punkt'
        };
        
        return effectNames[effect] || effect;
    }
    
    /**
     * Calculate animation interval based on speed and route length
     */
    function calculateAnimationInterval(speedValue, numPoints) {
        // Map speed value (1-10) to interval (slower to faster)
        // 1 = slowest (200ms), 10 = fastest (20ms)
        const baseInterval = 220 - (speedValue * 20);
        
        // Adjust for route length
        const routeAdjustment = Math.min(1, 100 / numPoints);
        
        return Math.max(20, baseInterval * routeAdjustment);
    }
    
    /**
     * Clear the current route
     */
    function clearRoute() {
        // Clear any running animation
        if (isAnimationRunning) {
            pauseAnimation();
        }
        
        // Reset animation index
        currentAnimationIndex = 0;
        
        // Clear route coordinates
        routeCoordinates = [];
        
        // Reset route ID
        currentRouteId = null;
        
        // Clear animation trail
        clearAnimationTrail();
        
        // Reset milestone achievements
        speedMilestones = [];
        
        // Remove route elements from map
        if (routePath) {
            map.removeLayer(routePath);
            routePath = null;
        }
        
        if (animatedPath) {
            map.removeLayer(animatedPath);
            animatedPath = null;
        }
        
        if (movingMarker) {
            map.removeLayer(movingMarker);
            movingMarker = null;
        }
        
        // Remove traffic segment layers
        for (let i = 0; i < routeSegmentLayers.length; i++) {
            map.removeLayer(routeSegmentLayers[i]);
        }
        routeSegmentLayers = [];
        
        // Reset route info display
        document.querySelector('.route-info').style.display = 'none';
        
        // Reset traffic info elements
        document.querySelector('.traffic-info').style.display = 'none';
        document.querySelector('.traffic-conditions').style.display = 'none';
        document.getElementById('trafficSegments').innerHTML = '';
        
        // Reset traffic level indicators
        const levelBars = document.querySelectorAll('.traffic-level-bar');
        levelBars.forEach(bar => bar.classList.remove('active'));
        
        // Disable animation controls
        document.getElementById('startAnimation').disabled = true;
        document.getElementById('pauseAnimation').disabled = true;
        document.getElementById('resetAnimation').disabled = true;
        
        // Disable Google Maps button
        document.getElementById('openInGoogleMaps').disabled = true;
        
        // Update optimize button state
        document.getElementById('optimizeWaypoints').disabled = waypointMarkers.length === 0;
    }
    
    /**
     * Format distance for display
     */
    function formatDistance(meters) {
        if (meters < 1000) {
            return `${Math.round(meters)} m`;
        } else {
            return `${(meters / 1000).toFixed(2)} km`;
        }
    }
    
    /**
     * Format duration for display
     */
    function formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (hours > 0) {
            return `${hours} godz. ${minutes} min`;
        } else {
            return `${minutes} min`;
        }
    }
    
    /**
     * Save the current route to the database
     */
    function saveCurrentRoute() {
        if (!currentRouteData) {
            alert('Najpierw oblicz trasę, aby ją zapisać');
            return;
        }
        
        const routeName = document.getElementById('routeName').value.trim();
        if (!routeName) {
            alert('Podaj nazwę trasy');
            return;
        }
        
        // Disable save button and show loading state
        const saveButton = document.getElementById('saveRoute');
        const originalText = saveButton.innerHTML;
        saveButton.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Zapisywanie...';
        saveButton.disabled = true;
        
        // Get start and end positions
        const startLatLng = startMarker.getLatLng();
        const endLatLng = endMarker.getLatLng();
        
        // Collect waypoints
        const waypoints = waypointMarkers.map(m => {
            const pos = m.marker.getLatLng();
            return [pos.lat, pos.lng];
        });
        
        // Create route data object
        const routeData = {
            name: routeName,
            description: document.getElementById('routeDescription').value.trim(),
            start: [startLatLng.lat, startLatLng.lng],
            end: [endLatLng.lat, endLatLng.lng],
            waypoints: waypoints,
            encoded_polyline: currentRouteData.encoded_polyline,
            distance: currentRouteData.distance,
            duration: currentRouteData.duration
        };
        
        // Send route data to the server
        fetch('/api/routes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(routeData)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            // Reset button state
            saveButton.innerHTML = originalText;
            saveButton.disabled = false;
            
            // Show success message
            alert('Trasa została zapisana pomyślnie');
            
            // Clear input fields
            document.getElementById('routeName').value = '';
            document.getElementById('routeDescription').value = '';
            
            // Refresh saved routes list
            loadSavedRoutes();
        })
        .catch(error => {
            console.error('Error saving route:', error);
            saveButton.innerHTML = originalText;
            saveButton.disabled = false;
            alert('Wystąpił błąd podczas zapisywania trasy. Spróbuj ponownie.');
        });
    }
    
    /**
     * Load saved routes from the database
     */
    function loadSavedRoutes() {
        const routesList = document.getElementById('savedRoutesList');
        const noRoutesMessage = document.getElementById('noRoutesMessage');
        
        // Show loading state
        routesList.innerHTML = '<div class="text-center"><span class="spinner-border spinner-border-sm"></span> Ładowanie tras...</div>';
        
        // Fetch routes from the server
        fetch('/api/routes')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(routes => {
            // Clear the list
            routesList.innerHTML = '';
            
            if (routes.length === 0) {
                // Show no routes message
                noRoutesMessage.style.display = 'block';
            } else {
                // Hide no routes message
                noRoutesMessage.style.display = 'none';
                
                // Add each route to the list
                routes.forEach(route => {
                    const routeItem = document.createElement('button');
                    routeItem.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';
                    routeItem.innerHTML = `
                        <div>
                            <h6 class="mb-1">${route.name}</h6>
                            <p class="mb-1 small text-muted">
                                ${formatDistance(route.distance)} • ${formatDuration(route.duration)}
                            </p>
                        </div>
                        <i class="fas fa-chevron-right"></i>
                    `;
                    
                    // Add click event to load the route
                    routeItem.addEventListener('click', function() {
                        loadRoute(route.id);
                    });
                    
                    routesList.appendChild(routeItem);
                });
            }
        })
        .catch(error => {
            console.error('Error loading routes:', error);
            routesList.innerHTML = '<div class="text-center text-danger">Błąd ładowania tras</div>';
        });
    }
    
    /**
     * Load a specific route from the database
     */
    function loadRoute(routeId) {
        // Show loading state
        const routesList = document.getElementById('savedRoutesList');
        routesList.innerHTML = '<div class="text-center"><span class="spinner-border spinner-border-sm"></span> Ładowanie trasy...</div>';
        
        // Fetch route data from the server
        fetch(`/api/route/${routeId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(route => {
            // Clear any existing route
            clearRoute();
            
            // Set start and end points
            setStartPoint(route.start[0], route.start[1]);
            setEndPoint(route.end[0], route.end[1]);
            
            // Add waypoints if any
            if (route.waypoints && route.waypoints.length > 0) {
                route.waypoints.forEach(waypoint => {
                    addWaypointAt(waypoint[0], waypoint[1]);
                });
            }
            
            // Draw route on the map
            const coordinates = route.polyline ? polyline.decode(route.polyline) : [];
            routeCoordinates = coordinates;
            
            // Store current route data
            currentRouteData = {
                encoded_polyline: route.polyline,
                distance: route.distance,
                duration: route.duration
            };
            
            // Draw the route
            drawRoute(routeCoordinates);
            
            // Update route info
            document.querySelector('.route-info').style.display = 'block';
            document.getElementById('routeDistance').textContent = formatDistance(route.distance);
            document.getElementById('routeDuration').textContent = formatDuration(route.duration);
            
            // Pre-fill route name for saving
            document.getElementById('routeName').value = `Kopia: ${route.name}`;
            if (route.description) {
                document.getElementById('routeDescription').value = route.description;
            }
            
            // Enable animation controls
            document.getElementById('startAnimation').disabled = false;
            document.getElementById('pauseAnimation').disabled = true;
            document.getElementById('resetAnimation').disabled = false;
            
            // Fit map to show the entire route
            const bounds = L.latLngBounds(routeCoordinates);
            map.fitBounds(bounds, { padding: [50, 50] });
            
            // Reload the routes list
            loadSavedRoutes();
        })
        .catch(error => {
            console.error('Error loading route:', error);
            routesList.innerHTML = '<div class="text-center text-danger">Błąd ładowania trasy</div>';
            setTimeout(loadSavedRoutes, 2000);
        });
    }
    
    /**
     * Get the user's current location
     */
    function getCurrentLocation() {
        // Check if geolocation is supported by the browser
        if (!navigator.geolocation) {
            showLocationError("Twoja przeglądarka nie obsługuje geolokalizacji!");
            return;
        }
        
        // Show loading state
        document.getElementById('getCurrentLocation').innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
        document.getElementById('getCurrentLocation').disabled = true;
        document.getElementById('locationStatus').textContent = "Ustalanie lokalizacji...";
        document.getElementById('locationStatus').classList.remove('text-danger', 'text-success');
        document.getElementById('locationStatus').classList.add('text-info');
        
        // Clear any existing watch
        stopLocationTracking();
        
        // Get the current position with high accuracy
        locationWatchId = navigator.geolocation.watchPosition(
            // Success callback
            function(position) {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                const accuracy = position.coords.accuracy;
                
                // Update location status
                document.getElementById('locationStatus').textContent = `Lokalizacja znaleziona (dokładność: ${Math.round(accuracy)}m)`;
                document.getElementById('locationStatus').classList.remove('text-danger', 'text-info');
                document.getElementById('locationStatus').classList.add('text-success');
                
                // Reset button
                document.getElementById('getCurrentLocation').innerHTML = '<i class="fas fa-location-arrow"></i> Pobierz lokalizację';
                document.getElementById('getCurrentLocation').disabled = false;
                
                // Enable location action buttons
                document.getElementById('useCurrentLocationStart').disabled = false;
                document.getElementById('useCurrentLocationEnd').disabled = false;
                document.getElementById('stopLocationTracking').disabled = false;
                
                // Update the map with the current location
                updateCurrentLocationMarker(lat, lng, accuracy);
                
                // Center the map on the current location
                map.setView([lat, lng], 16);
            },
            // Error callback
            function(error) {
                // Reset button
                document.getElementById('getCurrentLocation').innerHTML = '<i class="fas fa-location-arrow"></i> Pobierz lokalizację';
                document.getElementById('getCurrentLocation').disabled = false;
                
                // Disable location action buttons
                document.getElementById('useCurrentLocationStart').disabled = true;
                document.getElementById('useCurrentLocationEnd').disabled = true;
                
                // Show appropriate error message
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        showLocationError("Odmówiono dostępu do lokalizacji!");
                        break;
                    case error.POSITION_UNAVAILABLE:
                        showLocationError("Lokalizacja niedostępna!");
                        break;
                    case error.TIMEOUT:
                        showLocationError("Upłynął czas oczekiwania na lokalizację!");
                        break;
                    case error.UNKNOWN_ERROR:
                        showLocationError("Wystąpił nieznany błąd!");
                        break;
                }
            },
            // Options
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    }
    
    /**
     * Stop tracking the user's location
     */
    function stopLocationTracking() {
        if (locationWatchId !== null) {
            navigator.geolocation.clearWatch(locationWatchId);
            locationWatchId = null;
        }
        
        if (currentLocationMarker) {
            map.removeLayer(currentLocationMarker);
            currentLocationMarker = null;
        }
        
        // Reset UI
        document.getElementById('locationStatus').textContent = "Śledzenie lokalizacji zatrzymane";
        document.getElementById('locationStatus').classList.remove('text-danger', 'text-success', 'text-info');
        document.getElementById('stopLocationTracking').disabled = true;
        document.getElementById('useCurrentLocationStart').disabled = true;
        document.getElementById('useCurrentLocationEnd').disabled = true;
    }
    
    /**
     * Update the current location marker on the map
     */
    function updateCurrentLocationMarker(lat, lng, accuracy) {
        // Remove existing marker if it exists
        if (currentLocationMarker) {
            map.removeLayer(currentLocationMarker);
        }
        
        // Create a new marker
        currentLocationMarker = L.marker([lat, lng], {
            title: "Twoja lokalizacja",
            icon: L.divIcon({
                html: '<i class="fas fa-dot-circle" style="color: #3498db; font-size: 20px;"></i>',
                iconSize: [20, 20],
                className: 'current-location-marker'
            })
        }).addTo(map);
        
        // Add a circle to show accuracy
        const accuracyCircle = L.circle([lat, lng], {
            radius: accuracy,
            color: '#3498db',
            fillColor: '#3498db',
            fillOpacity: 0.15,
            weight: 1
        }).addTo(map);
        
        // Store the accuracy circle with the marker for later removal
        currentLocationMarker.accuracyCircle = accuracyCircle;
    }
    
    /**
     * Use the current location for start or end point
     */
    function useCurrentLocationFor(pointType) {
        if (!currentLocationMarker) {
            alert('Najpierw pobierz lokalizację!');
            return;
        }
        
        const currentPos = currentLocationMarker.getLatLng();
        
        if (pointType === 'start') {
            setStartPoint(currentPos.lat, currentPos.lng);
        } else if (pointType === 'end') {
            setEndPoint(currentPos.lat, currentPos.lng);
        }
    }
    
    /**
     * Show location error message
     */
    function showLocationError(message) {
        document.getElementById('locationStatus').textContent = message;
        document.getElementById('locationStatus').classList.remove('text-success', 'text-info');
        document.getElementById('locationStatus').classList.add('text-danger');
    }
});
