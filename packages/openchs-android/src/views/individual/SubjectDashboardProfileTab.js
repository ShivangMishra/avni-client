import {Alert, StyleSheet, Text, ToastAndroid, TouchableOpacity, View} from "react-native";
import PropTypes from 'prop-types';
import React from "react";
import AbstractComponent from "../../framework/view/AbstractComponent";
import Reducers from "../../reducer";
import Observations from "../common/Observations";
import {
    IndividualRegistrationDetailsActionsNames as Actions
} from "../../action/individual/IndividualRegistrationDetailsActions";
import {Actions as GeneralEncounterActions} from "../../action/individual/IndividualGeneralHistoryActions";
import General from "../../utility/General";
import Styles from "../primitives/Styles";
import Fonts from "../primitives/Fonts";
import ObservationsSectionTitle from '../common/ObservationsSectionTitle';
import Relatives from "../common/Relatives";
import ContextAction from "../viewmodel/ContextAction";
import DGS from "../primitives/DynamicGlobalStyles";
import CHSNavigator from "../../utility/CHSNavigator";
import TypedTransition from "../../framework/routing/TypedTransition";
import IndividualAddRelativeView from "../individual/IndividualAddRelativeView";
import Colors from "../primitives/Colors";
import {Privilege, WorkItem, WorkList, WorkLists} from "avni-models";
import ObservationsSectionOptions from "../common/ObservationsSectionOptions";
import Separator from "../primitives/Separator";
import Distances from "../primitives/Distances";
import Icon from 'react-native-vector-icons/SimpleLineIcons';
import GenericDashboardView from "../program/GenericDashboardView";
import FormMappingService from "../../service/FormMappingService";
import PrivilegeService from "../../service/PrivilegeService";
import Members from "../groupSubject/Members";
import AddNewMemberView from "../groupSubject/AddNewMemberView";
import RemoveMemberView from "../groupSubject/RemoveMemberView";
import {AvniAlert} from "../common/AvniAlert";
import _ from "lodash";
import {firebaseEvents, logEvent} from "../../utility/Analytics";
import SubjectDashboardGeneralTab from "./SubjectDashboardGeneralTab";
import NewFormButton from "../common/NewFormButton";
import SubjectProgramEligibilityWidget from "./SubjectProgramEligibilityWidget";
import CustomActivityIndicator from "../CustomActivityIndicator";
import GroupSubjectService from "../../service/GroupSubjectService";
import UserInfoService from "../../service/UserInfoService";
import AvniToast from "../common/AvniToast";
import {SubjectType} from "openchs-models";

class SubjectDashboardProfileTab extends AbstractComponent {
    static propTypes = {
        params: PropTypes.object.isRequired
    };

    constructor(props, context) {
        super(props, context, Reducers.reducerKeys.individualRegistrationDetails);
        this.formMappingService = context.getService(FormMappingService);
        this.privilegeService = context.getService(PrivilegeService);
    }

    UNSAFE_componentWillMount() {
        const newEncounterCallback = (encounter) => {
            CHSNavigator.navigateToEncounterView(this, {
                individualUUID: this.props.params.individualUUID,
                encounter: encounter,
            });
        };
        this.dispatchAction(Actions.ON_LOAD, {individualUUID: this.props.params.individualUUID});
        this.dispatchAction(GeneralEncounterActions.ON_LOAD, {
            individualUUID: this.props.params.individualUUID,
            newEncounterCallback
        });
        return super.UNSAFE_componentWillMount();
    }

    getRelativeActions() {
        return [new ContextAction(this.I18n.t('addRelative'), () => {
            CHSNavigator.navigateToAddRelativeView(this, this.state.individual,
                (source) => TypedTransition.from(source)
                    .resetStack([IndividualAddRelativeView], [
                        TypedTransition.createRoute(GenericDashboardView, {
                            individualUUID: this.state.individual.uuid,
                            message: this.I18n.t('newRelativeAddedMsg'),
                            tab: 1
                        })
                    ])
            )
        })];
    }

    addMemberActions() {
        const addMemberCriteria = `privilege.name = '${Privilege.privilegeName.addMember}' AND privilege.entityType = '${Privilege.privilegeEntityType.subject}'`;
        const allowedSubjectTypesForAddMember = this.privilegeService.allowedEntityTypeUUIDListForCriteria(addMemberCriteria, 'subjectTypeUuid');
        if (this.privilegeService.hasAllPrivileges() || _.includes(allowedSubjectTypesForAddMember, this.state.individual.subjectType.uuid)) {
            return [new ContextAction(this.I18n.t('addMember'), () => {
                const groupRoles = this.context.getService(GroupSubjectService).getGroupRoles(this.state.individual.subjectType)
                if (_.isEmpty(groupRoles))
                    Alert.alert(this.I18n.t("rolesNotConfigured"), this.I18n.t("rolesNotConfiguredDescription"), [
                        {text: this.I18n.t('okay'), onPress: _.noop}
                    ]);
                else
                    CHSNavigator.navigateToAddMemberView(this, this.state.individual)
            })];
        } else return []
    }

    onMemberEdit(groupSubject) {
        TypedTransition.from(this).with({groupSubject}).to(AddNewMemberView)
    }

    onMemberRemove(groupSubject) {
        TypedTransition.from(this).with({groupSubject}).to(RemoveMemberView);
    }

    alert(title, message, onYesPress) {
        Alert.alert(title, message, [
            {
                text: this.I18n.t('yes'), onPress: onYesPress
            },
            {
                text: this.I18n.t('no'), onPress: () => {
                },
                style: 'cancel'
            }
        ])
    }

    onRelativeDeletePress(individualRelative) {
        AvniAlert(this.I18n.t('deleteRelativeNoticeTitle'), this.I18n.t('deleteRelativeConfirmationMessage', {
            individualA: individualRelative.individual.name,
            individualB: individualRelative.relative.name
        }), () => this.dispatchAction(Actions.ON_DELETE_RELATIVE, {individualRelative: individualRelative}), this.I18n, true)
    }

    editProfile() {
        logEvent(firebaseEvents.EDIT_SUBJECT);
        this.dispatchAction(Actions.ON_EDIT_START, {
            continueRegistrationEdit: () => {
                CHSNavigator.navigateToRegisterView(this, {
                    workLists: new WorkLists(
                        new WorkList(`${this.state.individual.subjectType.name} `,
                            [new WorkItem(General.randomUUID(), WorkItem.type.REGISTRATION,
                                {
                                    uuid: this.state.individual.uuid,
                                    subjectTypeName: this.state.individual.subjectType.name
                                })]))
                });
            }
        });
    }

    editSubjectByFEG(pageNumber) {
        logEvent(firebaseEvents.EDIT_SUBJECT);
        const canMoveToNextView = _.get(this.state.individual.validateRegistrationDate(), "success");
        this.dispatchAction(Actions.ON_EDIT_START, {
            continueRegistrationEdit: () => {
                CHSNavigator.navigateToRegisterView(this, {
                    workLists: new WorkLists(
                        new WorkList(`${this.state.individual.subjectType.name} `,
                            [new WorkItem(General.randomUUID(), WorkItem.type.REGISTRATION,
                                {
                                    uuid: this.state.individual.uuid,
                                    subjectTypeName: this.state.individual.subjectType.name,
                                })]))
                }, pageNumber, canMoveToNextView);
            }
        });
    }

    onSubjectSelection(individualUUID) {
        TypedTransition.from(this).resetStack([GenericDashboardView],
            [TypedTransition.createRoute(GenericDashboardView, {individualUUID, tab: 1}, true)])
    }

    renderRelatives() {
        return (
            <View style={{marginTop: 20}}>
                <View style={{paddingLeft: 10}}>
                    <ObservationsSectionTitle contextActions={this.getRelativeActions()}
                                              title={this.I18n.t('Relatives')}
                                              titleStyle={Styles.dashboardSubsectionTitleText}/>
                </View>
                <Relatives relatives={this.state.relatives}
                           style={{marginVertical: DGS.resizeHeight(8)}}
                           onRelativeSelection={(source, individual) => this.onSubjectSelection(individual.uuid)}
                           onRelativeDeletion={this.onRelativeDeletePress.bind(this)}/>
            </View>
        );
    }

    renderMembers() {
        const groupSubjects = this.state.groupSubjects;
        const applicableActions = [];
        const editMemberCriteria = `privilege.name = '${Privilege.privilegeName.editMember}' AND privilege.entityType = '${Privilege.privilegeEntityType.subject}'`;
        const removeMemberCriteria = `privilege.name = '${Privilege.privilegeName.removeMember}' AND privilege.entityType = '${Privilege.privilegeEntityType.subject}'`;
        const allowedSubjectTypesForEditMember = this.privilegeService.allowedEntityTypeUUIDListForCriteria(editMemberCriteria, 'subjectTypeUuid');
        const allowedSubjectTypesForRemoveMember = this.privilegeService.allowedEntityTypeUUIDListForCriteria(removeMemberCriteria, 'subjectTypeUuid');
        const editAllowed = this.checkPrivilege(allowedSubjectTypesForEditMember, applicableActions, {
            label: 'edit',
            fn: (groupSubject) => this.onMemberEdit(groupSubject)
        });
        const removeAllowed = this.checkPrivilege(allowedSubjectTypesForRemoveMember, applicableActions, {
            label: 'remove',
            color: Colors.CancelledVisitColor,
            fn: (groupSubject) => this.onMemberRemove(groupSubject)
        });
        const nonVoidedMembersGroupSubjects = _.filter(groupSubjects, (groupSubject) => !groupSubject.memberSubject.voided);
        return (
            <View style={styles.container}>
                <TouchableOpacity
                    onPress={() => this.dispatchAction(Actions.ON_TOGGLE, {keyName: 'expandMembers'})}>
                    <ObservationsSectionTitle contextActions={this.addMemberActions()}
                                              title={`${this.I18n.t('members')} (${nonVoidedMembersGroupSubjects.length})`}
                                              titleStyle={Styles.cardTitle}/>
                    <View style={{right: 2, position: 'absolute', alignSelf: 'center'}}>
                        {this.state.expandMembers === false ?
                            <Icon name={'arrow-down'} size={12}/> :
                            <Icon name={'arrow-up'} size={12}/>}
                    </View>
                </TouchableOpacity>
                <View style={{marginTop: 3}}>
                    {this.state.expandMembers === true && nonVoidedMembersGroupSubjects.length > 0 ?
                        <View style={styles.memberCard}>
                            <Members groupSubjects={nonVoidedMembersGroupSubjects}
                                     onMemberSelection={(memberSubjectUUID) => this.onSubjectSelection(memberSubjectUUID)}
                                     actions={applicableActions}
                                     editAllowed={editAllowed}
                                     removeAllowed={removeAllowed}/>
                        </View> : <View/>}
                </View>
            </View>
        );
    }


    checkPrivilege(allowedSubjectTypes, applicableActions, action) {
        if (this.privilegeService.hasAllPrivileges() || _.includes(allowedSubjectTypes, this.state.individual.subjectType.uuid)) {
            applicableActions.push(action);
            return true;
        }
        return false;
    }

    renderVoided() {
        return (
            <View>
                <Text style={{fontSize: Fonts.Large, color: Styles.redColor}}>
                    {this.I18n.t("thisIndividualHasBeenVoided")}
                </Text>
                <ObservationsSectionOptions
                    contextActions={[new ContextAction('unVoid', () => this.unVoidIndividual())]}/>
            </View>
        );
    }

    voidUnVoidAlert(title, message, setVoided) {
        Alert.alert(
            this.I18n.t(title),
            this.I18n.t(message),
            [
                {
                    text: this.I18n.t('yes'), onPress: () => {
                        this.dispatchAction(Actions.VOID_UN_VOID_INDIVIDUAL,
                            {
                                individualUUID: this.props.params.individualUUID,
                                setVoided: setVoided,
                                cb: () => {
                                }
                            },
                        );
                    }
                },
                {
                    text: this.I18n.t('no'), onPress: () => {
                    },
                    style: 'cancel'
                }
            ]
        )
    }

    voidIndividual() {
        this.voidUnVoidAlert('voidIndividualConfirmationTitle', 'voidIndividualConfirmationMessage', true)
    }

    unVoidIndividual() {
        this.voidUnVoidAlert('unVoidIndividualConfirmationTitle', 'unVoidIndividualConfirmationMessage', false)
    }

    renderSelectionOptions(hasEditPrivilege, hasVoidPrivilege) {
        const form = this.formMappingService.findRegistrationForm(this.state.individual.subjectType);
        const requiredActions = [];
        if (hasVoidPrivilege)
            requiredActions.push(new ContextAction('void', () => this.voidIndividual(), Colors.CancelledVisitColor));
        if (hasEditPrivilege)
            requiredActions.push(new ContextAction('edit', () => this.editProfile()));
        return _.isEmpty(form) ? <View/> :
            <TouchableOpacity onPress={() => this.dispatchAction(Actions.ON_TOGGLE, {keyName: 'expand'})}>
                <ObservationsSectionOptions
                    contextActions={requiredActions}/>
            </TouchableOpacity>
    }

    renderProfile() {
        const formMappingService = this.getService(FormMappingService);
        const registrationForm = formMappingService.findRegistrationForm(this.state.individual.subjectType);
        const createdBy = this.getService(UserInfoService).getCreatedBy(this.state.individual, this.I18n);
        const createdByMessage = _.isEmpty(createdBy) ? "" : this.I18n.t("by", {user: createdBy});

        const editProfileCriteria = `privilege.name = '${Privilege.privilegeName.editSubject}' AND privilege.entityType = '${Privilege.privilegeEntityType.subject}' AND subjectTypeUuid = '${this.state.individual.subjectType.uuid}'`;
        const voidProfileCriteria = `privilege.name = '${Privilege.privilegeName.voidSubject}' AND privilege.entityType = '${Privilege.privilegeEntityType.subject}' AND subjectTypeUuid = '${this.state.individual.subjectType.uuid}'`;
        const hasEditPrivilege = this.privilegeService.hasActionPrivilegeForCriteria(editProfileCriteria, 'subjectTypeUuid');
        const hasVoidPrivilege = this.privilegeService.hasActionPrivilegeForCriteria(voidProfileCriteria, 'subjectTypeUuid');
        return registrationForm ? (<View>
            <TouchableOpacity onPress={() => this.dispatchAction(Actions.ON_TOGGLE, {keyName: 'expand'})}>
                <View style={{flexDirection: 'column'}}>
                    <Text style={{fontSize: Fonts.Medium, color: Colors.DefaultPrimaryColor}}>
                        {`${this.I18n.t("registeredOn")} ${General.toDisplayDate(this.state.individual.registrationDate)} ${createdByMessage}`}
                    </Text>
                </View>
                <View style={{right: 2, position: 'absolute', alignSelf: 'center'}}>
                    {this.state.expand === false ? <Icon name={'arrow-down'} size={12}/> :
                        <Icon name={'arrow-up'} size={12}/>}
                </View>
            </TouchableOpacity>
            <View style={{marginTop: 3}}>
                {this.state.expand === true ? <View style={{paddingHorizontal: 10}}>
                    <Observations form={registrationForm}
                                  observations={this.state.individual.observations}
                                  style={{marginVertical: 3}}
                                  quickFormEdit={hasEditPrivilege}
                                  onFormElementGroupEdit={(pageNumber) => this.editSubjectByFEG(pageNumber)}
                    />
                </View> : <View/>}
                {this.renderSelectionOptions(hasEditPrivilege, hasVoidPrivilege)}
            </View>
        </View>) : (<View style={{flexDirection: 'column'}}>
            <Text style={{fontSize: Fonts.Medium, color: Colors.DefaultPrimaryColor}}>
                {`${this.I18n.t("registeredOn")} ${General.toDisplayDate(this.state.individual.registrationDate)}. ${createdByMessage}`}
            </Text>
        </View>);
    }

    renderProfileOrVoided(individual) {
        if (individual.subjectType.getSetting(SubjectType.settingKeys.displayRegistrationDetails) !== false) {
            return <View>
                <Text style={[Styles.dashboardSubsectionTitleText, {paddingLeft: 10}]}>
                    {this.I18n.t("registrationInformation")}
                </Text>
                <View style={styles.container}>
                    {individual.voided ? this.renderVoided() : this.renderProfile()}
                </View>
            </View>
        }
    }

    renderSummary() {
        return <View>
            <View style={{marginLeft: 10}}>
                <Text style={Styles.dashboardSubsectionTitleText}>{this.I18n.t('subjectSummary')}</Text>
            </View>

            <View style={{
                padding: Distances.ScaledContentDistanceFromEdge,
                margin: 4,
                backgroundColor: Styles.greyBackground,
                marginVertical: 16,
                borderWidth: 2,
                borderColor: Styles.greyBackground,
                borderRadius: 10
            }}>
                <Observations observations={_.defaultTo(this.state.subjectSummary, [])}
                              style={{marginVertical: DGS.resizeHeight(8)}}/>
            </View>
        </View>
    }

    render() {
        General.logDebug(this.viewName(), 'render');
        const displayGeneralEncounterInfo = this.props.params.displayGeneralInfoInProfileTab;
        const {individual, editFormRuleResponse, isRelationshipTypePresent, displayIndicator, subjectProgramEligibilityStatuses} = this.state;
        const relativesFeatureToggle = individual.isPerson() && isRelationshipTypePresent;
        const groupSubjectToggle = individual.subjectType.isGroup();
        return (
            <View style={{backgroundColor: Colors.WhiteContentBackground, marginTop: 10}}>
                <View style={{marginHorizontal: 10}}>
                    <NewFormButton display={displayGeneralEncounterInfo} style={{marginBottom: 50}}/>
                    <CustomActivityIndicator loading={displayIndicator}/>
                    <SubjectProgramEligibilityWidget
                        subject={individual}
                        subjectProgramEligibilityStatuses={subjectProgramEligibilityStatuses}
                        onSubjectProgramEligibilityPress={(subjectProgramEligibilityStatuses) => this.dispatchAsyncAction(Actions.ON_SUBJECT_PROGRAM_ELIGIBILITY_CHECK, {subjectProgramEligibilityStatuses})}
                        onManualProgramEligibilityPress={_.noop}
                        onDisplayIndicatorToggle={(display) => this.dispatchAction(Actions.ON_DISPLAY_INDICATOR_TOGGLE, {display})}
                    />
                    {!_.isEmpty(this.state.subjectSummary) && this.renderSummary()}
                    {this.renderProfileOrVoided(individual)}
                    {relativesFeatureToggle ? this.renderRelatives() : <View/>}
                    {groupSubjectToggle ? this.renderMembers() : <View/>}
                </View>
                {displayGeneralEncounterInfo && <SubjectDashboardGeneralTab {...this.props}/>}
                <Separator height={110} backgroundColor={Colors.WhiteContentBackground}/>
                {editFormRuleResponse.isDisallowed() &&
                    <AvniToast message={this.I18n.t(editFormRuleResponse.getMessage())} onAutoClose={() => this.dispatchAction(Actions.ON_EDIT_ERROR_SHOWN)}/>}
            </View>
        );
    }
}

export default SubjectDashboardProfileTab;


const styles = StyleSheet.create({
    container: {
        padding: Distances.ScaledContentDistanceFromEdge,
        margin: 4,
        backgroundColor: Styles.greyBackground,
        marginVertical: 3,
        borderRadius: 10,
    },
    memberCard: {
        marginTop: 5,
        marginHorizontal: 6,
        paddingVertical: 10,
        borderBottomLeftRadius: 1.5,
        borderBottomRightRadius: 1.5,
        borderTopLeftRadius: 1.5,
        borderTopRightRadius: 1.5,
        shadowOffset: {width: 10, height: 10},
        shadowColor: Styles.greyBackground,
        shadowOpacity: 1,
        elevation: 1,
    }
});
