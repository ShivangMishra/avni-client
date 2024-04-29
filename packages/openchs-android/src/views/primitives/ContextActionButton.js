import PropTypes from 'prop-types';
import React from "react";
import AbstractComponent from "../../framework/view/AbstractComponent";
import {Button, Text} from "native-base";
import Colors from "../primitives/Colors";
import Fonts from "../primitives/Fonts";
import {TouchableOpacity} from 'react-native'
import Styles from "./Styles";

class ContextActionButton extends AbstractComponent {
    static propTypes = {
        labelKey: PropTypes.string.isRequired,
        onPress: PropTypes.func.isRequired
    };

    constructor(props, context) {
        super(props, context);
    }

    render() {
        const color = this.props.textColor || Colors.ActionButtonColor;
        return (
            <TouchableOpacity onPress={() => this.props.onPress()} style={{paddingHorizontal: 25}}>
                <Text style={{
                    fontSize: Fonts.Medium,
                    color: color,
                    paddingHorizontal: 5,
                    backgroundColor: Styles.greyBackground,
                    borderRadius: 5,
                    elevation: 2
                }}>{`${this.I18n.t(this.props.labelKey)}`}</Text></TouchableOpacity>
        );
    }
}

export default ContextActionButton;
