import IndividualService from "../../service/IndividualService";
import ProgramService from "../../service/program/ProgramService";
import IndividualRelationshipService from "../../service/relationship/IndividualRelationshipService";
import GroupSubjectService from "../../service/GroupSubjectService";
import RuleEvaluationService from "../../service/RuleEvaluationService";
import {Individual, SubjectProgramEligibility} from 'avni-models';
import IndividualRelationGenderMappingService from "../../service/relationship/IndividualRelationGenderMappingService";
import _ from 'lodash';
import SubjectProgramEligibilityService from "../../service/program/SubjectProgramEligibilityService";
import EntityService from "../../service/EntityService";
import FormMappingService from "../../service/FormMappingService";
import GroupAffiliationState from '../../state/GroupAffiliationState';
import {ActionEligibilityResponse} from "rules-config";
import General from "../../utility/General";

class IndividualRegistrationDetailsActions {
    static getInitialState() {
        return {
            expand: false,
            subjectProgramEligibilityStatuses: [],
            displayIndicator: false,
            groupAffiliationState: new GroupAffiliationState(),
            editFormRuleResponse: ActionEligibilityResponse.createAllowedResponse()
        };
    }

    static onLoad(state, action, context) {
        const individual = context.get(IndividualService).findByUUID(action.individualUUID);
        const individualRelationGenderMappings = context.get(IndividualRelationGenderMappingService).filtered('voided = false');
        const relatives = context.get(IndividualRelationshipService).getRelatives(individual);
        const groupSubjects = context.get(GroupSubjectService).getGroupSubjects(individual);
        const subjectSummary = context.get(RuleEvaluationService).getSubjectSummary(individual, Individual.schema.name, context);
        const subjectProgramEligibilityStatuses = IndividualRegistrationDetailsActions.getSubjectProgramEligibilityStatuses(individual, context);
        const groupAffiliationState = new GroupAffiliationState();
        context.get(GroupSubjectService).populateGroupsThatTheIndividualIsAMemberOf(individual, groupAffiliationState);

        return {
            ...state,
            individual,
            relatives,
            groupSubjects,
            programsAvailable: context.get(ProgramService).programsAvailable,
            expand: false,
            expandMembers: false,
            subjectSummary,
            isRelationshipTypePresent: individualRelationGenderMappings.length > 0,
            subjectProgramEligibilityStatuses,
            groupAffiliation: groupAffiliationState
        };
    }

    static onEditStart(state, action, context) {
        const registrationForm = context.get(FormMappingService).findRegistrationForm(state.individual.subjectType);
        const editFormRuleResponse = context.get(RuleEvaluationService).runEditFormRule(registrationForm, state.individual, 'Individual');
        const newState = {...state};
        if (editFormRuleResponse.isAllowed())
            action.continueRegistrationEdit();
        else
            newState.editFormRuleResponse = editFormRuleResponse;
        return newState;
    }

    static onEditErrorShown(state) {
        return {...state, editFormRuleResponse: ActionEligibilityResponse.createAllowedResponse()}
    }

    static onDeleteRelative(state, action, context) {
        context.get(IndividualRelationshipService).deleteRelative(action.individualRelative);
        const relatives = context.get(IndividualRelationshipService).getRelatives(state.individual);
        return {
            ...state,
            individual: state.individual,
            relatives: relatives,
            programsAvailable: state.programsAvailable
        };
    }

    static voidUnVoidIndividual(state, action, beans) {
        const individualService = beans.get(IndividualService);
        individualService.voidUnVoidIndividual(action.individualUUID, action.setVoided, state.groupAffiliation);
        action.cb();
        return IndividualRegistrationDetailsActions.onLoad(state, action, beans);
    }

    static onToggle(state, action) {
        const expandKey = action.keyName;
        return {...state, [expandKey]: !state[expandKey]};
    }

    static onSubjectProgramEligibilityCheck(state, action, context) {
        const newState = {...state};
        _.forEach(action.subjectProgramEligibilityStatuses, status => IndividualRegistrationDetailsActions.saveSubjectProgramEligibility(status, context));
        newState.subjectProgramEligibilityStatuses = IndividualRegistrationDetailsActions.getSubjectProgramEligibilityStatuses(state.individual, context);
        newState.displayIndicator = false;
        return newState;
    }

    static onDisplayIndicatorToggle(state, action, context) {
        const newState = {...state};
        newState.displayIndicator = action.display;
        return newState;
    }

    static saveSubjectProgramEligibility(subjectProgramEligibilityStatus, context) {
        const subjectProgramEligibilityService = context.get(SubjectProgramEligibilityService);
        const savedSubjectProgramEligibility = subjectProgramEligibilityService.findBySubjectUUIDAndProgramUUID(
            subjectProgramEligibilityStatus.subjectUUID,
            subjectProgramEligibilityStatus.programUUID
        );
        const subjectProgramEligibilityToSave = SubjectProgramEligibility.buildFromSubjectProgramEligibilityStatus(
            subjectProgramEligibilityStatus,
            savedSubjectProgramEligibility,
            context.get(EntityService)
        );
        subjectProgramEligibilityService.saveOrUpdate(subjectProgramEligibilityToSave);
    }

    static getSubjectProgramEligibilityStatuses(subject, context) {
        const subjectProgramEligibilityStatues = [];
        const addStatusesForSubject = (subject) => {
            const allProgramStatuses = this.createSubjectProgramEligibilityStatusesForEachProgram(subject, context);
            if (!_.isEmpty(allProgramStatuses)) {
                subjectProgramEligibilityStatues.push({subject, data: allProgramStatuses})
            }
        };

        const nonVoidedGroupSubjects = _.filter(subject.groupSubjects, (groupSubject) => !groupSubject.voided);
        if (subject.isGroup()) {
            _.forEach(nonVoidedGroupSubjects, ({memberSubject}) => addStatusesForSubject(memberSubject))
        }
        addStatusesForSubject(subject);
        return subjectProgramEligibilityStatues;
    }

    static createSubjectProgramEligibilityStatusesForEachProgram(subject, context) {
        const eligibleProgramsUUID = context.get(IndividualService).eligiblePrograms(subject.uuid).map(({uuid}) => uuid);
        const subjectProgramEligibilityRequired = !_.isEmpty(subject.subjectType.programEligibilityCheckRule);
        const subjectProgramEligibilityService = context.get(SubjectProgramEligibilityService);
        const programs = context.get(FormMappingService).findProgramsForSubjectType(subject.subjectType);
        const applicablePrograms = _.filter(programs, program => program.manualEligibilityCheckRequired || subjectProgramEligibilityRequired);
        return _.map(applicablePrograms, program => {
            const subjectProgramEligibility = subjectProgramEligibilityService.findBySubjectAndProgram(subject, program);
            const isStatusEligible = !!_.get(subjectProgramEligibility, 'eligible');
            return {
                program,
                subjectProgramEligibility,
                isEnrolmentEligible: isStatusEligible && _.includes(eligibleProgramsUUID, program.uuid)
            }
        });
    }

    static checkMemberAdditionEligibility(member, group, context) {
        return context.get(RuleEvaluationService).getMemberAdditionEligibilityStatus(member, group, context);
    }
}

const IndividualRegistrationDetailsActionsNames = {
    ON_LOAD: 'IRDA.ON_LOAD',
    ON_DELETE_RELATIVE: 'IRDA.ON_DELETE_RELATIVE',
    VOID_UN_VOID_INDIVIDUAL: "IRDA.VOID_INDIVIDUAL",
    ON_TOGGLE: "IRDA.ON_TOGGLE",
    ON_SUBJECT_PROGRAM_ELIGIBILITY_CHECK: "IRDA.ON_SUBJECT_PROGRAM_ELIGIBILITY_CHECK",
    ON_DISPLAY_INDICATOR_TOGGLE: "IRDA.ON_DISPLAY_INDICATOR_TOGGLE",
    ON_EDIT_START: "IRDA.ON_EDIT_START",
    ON_EDIT_ERROR_SHOWN: "IRDA.ON_EDIT_ERROR_SHOWN"
};

const IndividualRegistrationDetailsActionsMap = new Map([
    [IndividualRegistrationDetailsActionsNames.ON_LOAD, IndividualRegistrationDetailsActions.onLoad],
    [IndividualRegistrationDetailsActionsNames.ON_DELETE_RELATIVE, IndividualRegistrationDetailsActions.onDeleteRelative],
    [IndividualRegistrationDetailsActionsNames.VOID_UN_VOID_INDIVIDUAL, IndividualRegistrationDetailsActions.voidUnVoidIndividual],
    [IndividualRegistrationDetailsActionsNames.ON_TOGGLE, IndividualRegistrationDetailsActions.onToggle],
    [IndividualRegistrationDetailsActionsNames.ON_SUBJECT_PROGRAM_ELIGIBILITY_CHECK, IndividualRegistrationDetailsActions.onSubjectProgramEligibilityCheck],
    [IndividualRegistrationDetailsActionsNames.ON_DISPLAY_INDICATOR_TOGGLE, IndividualRegistrationDetailsActions.onDisplayIndicatorToggle],
    [IndividualRegistrationDetailsActionsNames.ON_EDIT_START, IndividualRegistrationDetailsActions.onEditStart],
    [IndividualRegistrationDetailsActionsNames.ON_EDIT_ERROR_SHOWN, IndividualRegistrationDetailsActions.onEditErrorShown],
]);

export {
    IndividualRegistrationDetailsActionsNames,
    IndividualRegistrationDetailsActionsMap,
    IndividualRegistrationDetailsActions
};
