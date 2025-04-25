document.addEventListener('DOMContentLoaded', function() {
    // Initialize variables
    let map;
    let startMarker, endMarker, movingMarker;
    let routePath, animatedPath;
    let routeCoordinates = [];
    let animationInterval;
    let currentAnimationIndex = 0;
    let isAnimationRunning = false;
    
    // Initialize map centered on a default location (New York City)
    initMap();
    
    // Set up event listeners
    document.getElementById('calculateRoute').addEventListener('click', calculateRoute);
    document.getElementById('startAnimation').addEventListener('click', startAnimation);
    document.getElementById('pauseAnimation').addEventListener('click', pauseAnimation);
    document.getElementById('resetAnimation').addEventListener('click', resetAnimation);
    document.getElementById('animationSpeed').addEventListener('input', updateAnimationSpeed);
    
    // Set up coordinate input fields
    const startInput = document.getElementById('startLocation');
    const endInput = document.getElementById('endLocation');
    
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
        
        // Add click handler for setting start/end points
        map.on('click', function(e) {
            if (!startMarker) {
                setStartPoint(e.latlng.lat, e.latlng.lng);
            } else if (!endMarker) {
                setEndPoint(e.latlng.lat, e.latlng.lng);
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
     * Calculate the route between start and end points
     */
    function calculateRoute() {
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
        
        // Fetch route from backend
        fetch('/api/directions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                start: [startLatLng.lat, startLatLng.lng],
                end: [endLatLng.lat, endLatLng.lng]
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
            return `${hours} hr ${minutes} min`;
        } else {
            return `${minutes} min`;
        }
    }
});
