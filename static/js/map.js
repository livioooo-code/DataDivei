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
        document.getElementById('calculateRoute').innerHTML = '<span class="spinner-border spinner-border-sm"></span> Loading...';
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
                optimize: optimize
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
            document.getElementById('calculateRoute').innerHTML = '<i class="fas fa-route me-2"></i>Calculate Route';
            document.getElementById('calculateRoute').disabled = false;
            
            // Process the route
            if (data.route && data.route.length > 0) {
                // Store route coordinates
                routeCoordinates = data.route.map(point => [point[0], point[1]]);
                
                // Draw the route on the map
                drawRoute(routeCoordinates);
                
                // Update route info
                document.querySelector('.route-info').style.display = 'block';
                document.getElementById('routeDistance').textContent = formatDistance(data.distance);
                document.getElementById('routeDuration').textContent = formatDuration(data.duration);
                
                // Enable animation controls
                document.getElementById('startAnimation').disabled = false;
                document.getElementById('pauseAnimation').disabled = true;
                document.getElementById('resetAnimation').disabled = false;
                
                // Fit map to show the entire route
                const bounds = L.latLngBounds(routeCoordinates);
                map.fitBounds(bounds, { padding: [50, 50] });
            } else {
                alert('Could not find a route between these points');
            }
        })
        .catch(error => {
            console.error('Error calculating route:', error);
            document.getElementById('calculateRoute').innerHTML = '<i class="fas fa-route me-2"></i>Calculate Route';
            document.getElementById('calculateRoute').disabled = false;
            alert('Error calculating route. Please try again.');
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
        
        // Get animation speed
        const speed = Number(document.getElementById('animationSpeed').value);
        
        // Calculate interval based on speed and route length
        const interval = calculateAnimationInterval(speed, routeCoordinates.length);
        
        // Start animation
        animationInterval = setInterval(() => {
            // Check if we've reached the end
            if (currentAnimationIndex >= routeCoordinates.length - 1) {
                pauseAnimation();
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
        movingMarker.setLatLng(currentPos);
        
        // Follow animation if enabled
        if (document.getElementById('followAnimation').checked) {
            map.panTo(currentPos);
        }
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
        
        // Reset route info display
        document.querySelector('.route-info').style.display = 'none';
        
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
