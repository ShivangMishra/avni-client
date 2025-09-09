import React, { useState, useEffect, useRef } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Camera, useCameraDevices, useFrameProcessor } from "react-native-vision-camera";
import { scanOCR } from "vision-camera-ocr";
import { runOnJS } from "react-native-reanimated";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import Colors from "../../primitives/Colors";
import I18n from 'i18n-js';

const OCRScanner = (props) => {
    const [hasPermission, setHasPermission] = useState(false);
    const [refresh, setRefresh] = useState(false);
    const [isScanning, setIsScanning] = useState(true);
    const [hasScanned, setHasScanned] = useState(false);
    const timeoutRef = useRef(null);
    const devices = useCameraDevices();
    const device = devices.back;

    useEffect(() => {
        // exception case for device changes
        setRefresh(!refresh);
    }, [device, hasPermission]);

    useEffect(() => {
        const requestCameraPermission = async () => {
            const permission = await Camera.requestCameraPermission();
            console.log("Camera permission:", permission);
            setHasPermission(permission === "granted" || permission === "authorized");
        };

        requestCameraPermission();

        // Auto close after 30 seconds if no scan
        timeoutRef.current = setTimeout(() => {
            if (!hasScanned) {
                console.log("OCRScanner: Auto-close timeout triggered");
                props.onRead(null);
            }
        }, 30 * 1000);

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
        };
    }, []);

    const handleTextDetection = (result) => {
        if (result && result.result && result.result.text && isScanning && !hasScanned) {
            const detectedText = result.result.text.trim();
            if (detectedText.length > 0) {
                console.log(`Text detected:`, detectedText);

                // Clear the timeout immediately when text is detected
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                    timeoutRef.current = null;
                }

                setIsScanning(false);
                setHasScanned(true);
                props.onRead(detectedText);
            }
        }
    };

    const frameProcessor = useFrameProcessor((frame) => {
        'worklet';
        try {
            const result = scanOCR(frame);
            if (result && result.result && result.result.text) {
                runOnJS(handleTextDetection)(result);
            }
        } catch (error) {
            console.log('OCR scan error:', error);
        }
    }, [isScanning, hasScanned]);

    console.log("OCRScanner render - device:", !!device, "hasPermission:", hasPermission, "devices:", devices);

    if (device == null || !hasPermission) {
        return (
            <View style={styles.errorContainer}>
                <Icon name="camera-off" size={64} color={Colors.ValidationError} />
                <Text style={styles.errorText}>
                    {I18n.t('cameraNotAvailableOrPermissionNotGranted')}
                    {'\n'}Device: {device ? 'Found' : 'Not found'}
                    {'\n'}Permission: {hasPermission ? 'Granted' : 'Not granted'}
                    {'\n'}Devices: {JSON.stringify(Object.keys(devices || {}))}
                </Text>
                <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => props.onRead(null)}
                >
                    <Text style={styles.closeButtonText}>{I18n.t('CLOSE')}</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Camera
                style={StyleSheet.absoluteFill}
                device={device}
                isActive={true}
                frameProcessor={frameProcessor}
            />

            {/* Header with back button */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.headerButton}
                    onPress={() => props.onRead(null)}
                >
                    <Icon name="arrow-left" size={24} color="white" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{I18n.t('scanText')}</Text>
            </View>

            {/* Scanning overlay */}
            <View style={styles.overlay}>
                <View style={styles.scanArea}>
                    <View style={[styles.corner, styles.topLeft]} />
                    <View style={[styles.corner, styles.topRight]} />
                    <View style={[styles.corner, styles.bottomLeft]} />
                    <View style={[styles.corner, styles.bottomRight]} />
                </View>
                <Text style={styles.instructionText}>
                    {isScanning ? I18n.t('pointCameraAtText') : I18n.t('textScanning')}
                </Text>
            </View>

            {/* Footer with close button */}
            <View style={styles.footer}>
                <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => props.onRead(null)}
                >
                    <Text style={styles.closeButtonText}>{I18n.t('CLOSE')}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
    },
    errorContainer: {
        flex: 1,
        backgroundColor: 'white',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    errorText: {
        fontSize: 16,
        textAlign: 'center',
        marginTop: 16,
        marginBottom: 32,
        color: Colors.ValidationError,
    },
    header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 80,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingBottom: 10,
        paddingHorizontal: 16,
        zIndex: 1,
    },
    headerButton: {
        padding: 8,
        marginRight: 16,
    },
    headerTitle: {
        color: 'white',
        fontSize: 18,
        fontWeight: '600',
        flex: 1,
    },
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scanArea: {
        width: 280,
        height: 180,
        position: 'relative',
    },
    corner: {
        position: 'absolute',
        width: 30,
        height: 30,
        borderColor: Colors.AccentColor,
        borderWidth: 3,
    },
    topLeft: {
        top: 0,
        left: 0,
        borderBottomWidth: 0,
        borderRightWidth: 0,
    },
    topRight: {
        top: 0,
        right: 0,
        borderBottomWidth: 0,
        borderLeftWidth: 0,
    },
    bottomLeft: {
        bottom: 0,
        left: 0,
        borderTopWidth: 0,
        borderRightWidth: 0,
    },
    bottomRight: {
        bottom: 0,
        right: 0,
        borderTopWidth: 0,
        borderLeftWidth: 0,
    },
    instructionText: {
        color: 'white',
        fontSize: 16,
        marginTop: 32,
        textAlign: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 120,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 40,
    },
    closeButton: {
        backgroundColor: Colors.AccentColor,
        paddingHorizontal: 32,
        paddingVertical: 12,
        borderRadius: 8,
        minWidth: 120,
        alignItems: 'center',
    },
    closeButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default OCRScanner;
