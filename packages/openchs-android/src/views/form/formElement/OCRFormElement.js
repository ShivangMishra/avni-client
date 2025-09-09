import {Text, TouchableNativeFeedback, View, Modal, StyleSheet} from "react-native";
import PropTypes from 'prop-types';
import React from "react";
import AbstractFormElement from "./AbstractFormElement";
import ValidationErrorMessage from "../ValidationErrorMessage";
import Colors from "../../primitives/Colors";
import Fonts from "../../primitives/Fonts";
import FormElementLabelWithDocumentation from "../../common/FormElementLabelWithDocumentation";
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import OCRScanner from "./OCRScanner";
import _ from "lodash";

class OCRFormElement extends AbstractFormElement {
    static propTypes = {
        element: PropTypes.object.isRequired,
        actionName: PropTypes.string.isRequired,
        value: PropTypes.object,
        validationResult: PropTypes.object
    };

    constructor(props, context) {
        super(props, context);
        this.state = {
            showOCRScanner: false
        };
    }

    displayValue() {
        const value = this.props.value.getValue();
        return _.isNil(value) || value === ''
            ? this.I18n.t('tapToScanText')
            : value;
    }

    openOCRScanner() {
        this.setState({ showOCRScanner: true });
    }

    onTextRead(textValue) {
        this.setState({ showOCRScanner: false });
        if (textValue) {
            this.notifyChange(textValue);
        }
    }

    notifyChange(value) {
        this.props.value.answer = value;
        this.dispatchAction(this.props.actionName, {
            formElement: this.props.element,
            parentFormElement: this.props.parentElement,
            questionGroupIndex: this.props.questionGroupIndex,
            value: value
        });
    }

    removeValue() {
        this.notifyChange(null);
    }

    renderRemoveButton() {
        const hasValue = !_.isNil(this.props.value.getValue()) && this.props.value.getValue() !== '';
        if (hasValue) {
            return (
                <TouchableNativeFeedback onPress={() => this.removeValue()}
                                         background={TouchableNativeFeedback.SelectableBackgroundBorderless()}
                                         useForeground>
                    <Icon name="backspace"
                          style={{marginLeft: 8, fontSize: 20, color: Colors.AccentColor}}/>
                </TouchableNativeFeedback>
            );
        }
        return null;
    }

    render() {
        const hasValue = !_.isNil(this.props.value.getValue()) && this.props.value.getValue() !== '';

        return (
            <View>
                <FormElementLabelWithDocumentation element={this.props.element}/>
                <View style={{flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center'}}>
                    <TouchableNativeFeedback onPress={() => this.openOCRScanner()}
                                             background={TouchableNativeFeedback.SelectableBackground()}>
                        <View style={styles.ocrInputContainer}>
                            <Icon name="text-recognition"
                                  style={[styles.ocrIcon, {color: hasValue ? Colors.AccentColor : Colors.InputBorderNormal}]}/>
                            <Text style={[
                                styles.ocrText,
                                {
                                    color: _.isNil(this.props.validationResult) ?
                                        (hasValue ? Colors.InputNormal : Colors.InputBorderNormal) :
                                        Colors.ValidationError,
                                    fontStyle: hasValue ? 'normal' : 'italic'
                                }
                            ]} numberOfLines={3} ellipsizeMode="tail">
                                {this.displayValue()}
                            </Text>
                        </View>
                    </TouchableNativeFeedback>
                    {this.renderRemoveButton()}
                </View>
                <ValidationErrorMessage validationResult={this.props.validationResult}/>

                <Modal
                    visible={this.state.showOCRScanner}
                    animationType="slide"
                    onRequestClose={() => this.onTextRead(null)}>
                    <OCRScanner onRead={(textValue) => this.onTextRead(textValue)} />
                </Modal>
            </View>
        );
    }
}

const styles = StyleSheet.create({
    ocrInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.InputBorderNormal,
        borderRadius: 4,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: Colors.GreyContentBackground,
        flex: 1,
        minHeight: 60 // Slightly taller than QR to accommodate multi-line text
    },
    ocrIcon: {
        fontSize: 20,
        marginRight: 8,
        alignSelf: 'flex-start',
        marginTop: 2
    },
    ocrText: {
        fontSize: Fonts.Large,
        flex: 1,
        lineHeight: 20
    }
});

export default OCRFormElement;
