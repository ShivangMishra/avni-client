import {View} from "react-native";
import React from "react";
import _ from "lodash";
import SubjectFormElement from "./SubjectFormElement";
import ValidationErrorMessage from "../../form/ValidationErrorMessage";
import Distances from "../../primitives/Distances";
import RadioLabelValue from "../../primitives/RadioLabelValue";
import FormElementLabelWithDocumentation from "../../common/FormElementLabelWithDocumentation";
import SelectableItemGroup from "../../primitives/SelectableItemGroup";
import UserInfoService from "../../../service/UserInfoService";
import PropTypes from "prop-types";

class MultiSelectSubjectFormElement extends SubjectFormElement {
    constructor(props, context) {
        super(props, context);
    }

    static propTypes = {
        element: PropTypes.object.isRequired,
        actionName: PropTypes.string.isRequired,
        value: PropTypes.object,
        validationResult: PropTypes.object,
    };
    static defaultProps = {
        style: {}
    };

    render() {
        const subjectUUIDs = _.get(this.props.value, 'answer');
        const subjectOptions = this.getSubjectOptions();
        if (!_.isEmpty(subjectOptions) && subjectOptions.length <= this.SWITCH_TO_SEARCH_UI_THRESHOLD) {
            return this.renderSelectUI(subjectUUIDs, subjectOptions);
        } else {
            return this.renderSearchUI(subjectUUIDs);
        }
    }

    renderSearchUI(subjectUUIDs) {
        return (
            <View style={this.appendedStyle({paddingVertical: Distances.VerticalSpacingBetweenFormElements})}>
                <View style={{flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap'}}>
                    <FormElementLabelWithDocumentation element={this.props.element}/>
                    {this.renderSearchIcon()}
                </View>
                <View style={{flexDirection: 'row'}}>
                    {_.map(subjectUUIDs, subjectUUID => this.renderAnswer(this.individualService.findByUUID(subjectUUID)))}
                </View>
                <ValidationErrorMessage validationResult={this.props.validationResult}/>
            </View>
        )
    }

    renderSelectUI(subjectUUIDs, subjectOptions) {
        const currentLocale = this.getService(UserInfoService).getUserSettings().locale;
        const valueLabelPairs = subjectOptions
            .map((subject) => new RadioLabelValue(subject.nameStringWithUniqueAttribute, subject.uuid, false, subject));
        return (
            <View style={{flexDirection: 'column', paddingBottom: Distances.ScaledVerticalSpacingBetweenOptionItems}}>
                <SelectableItemGroup
                    multiSelect={true}
                    inPairs={false}
                    locale={currentLocale}
                    I18n={this.I18n}
                    onPress={(value) => this.toggleFormElementAnswerSelection(value)}
                    selectionFn={(subjectUUID) => subjectUUIDs.indexOf(subjectUUID) !== -1}
                    labelKey={this.props.element.name}
                    mandatory={this.props.element.mandatory}
                    validationError={this.props.validationResult}
                    labelValuePairs={valueLabelPairs}
                />
            </View>);
    }
}

export default MultiSelectSubjectFormElement;
